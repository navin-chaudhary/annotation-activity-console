/**
 * tasksSlice
 *
 * Owns the normalized task cache (via `createEntityAdapter`) plus the async
 * lifecycle of the initial fetch and the live-event merge logic.
 *
 * We use a hand-written thunk + entity adapter (not RTK Query) because three
 * different writers converge on ONE cache: the REST page fetch, the live
 * WebSocket feed, and the IndexedDB hydration. Owning the entity map directly
 * makes those merges explicit and easy to reason about. See DECISIONS.md.
 */
import {
  createAsyncThunk,
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { API_BASE, DEFAULT_PAGE_SIZE } from "@/lib/config";
import { writeTasksCache } from "@/features/persistence/cache";
import {
  normalizeAssignee,
  normalizeStatus,
  normalizeTasksResponse,
  normalizeTimestamp,
} from "./normalize";
import type {
  AnnotationCreatedEvent,
  Assignee,
  PageMeta,
  Task,
  TaskAssignedEvent,
  TaskUpdatedEvent,
} from "./types";

export const tasksAdapter = createEntityAdapter<Task>({
  sortComparer: (a, b) => b.updatedAt - a.updatedAt,
});

export type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

/** Where the currently displayed data came from. */
export type DataSource = "none" | "cache" | "network";

interface TasksExtraState {
  loadStatus: LoadStatus;
  error: string | null;
  meta: PageMeta;
  /** "cache" until a network response confirms freshness. */
  source: DataSource;
  /** epoch ms of the last successful network load. */
  lastUpdatedAt: number | null;
  /** number of records the server sent that we could not key. */
  droppedLastLoad: number;
}

const initialExtra: TasksExtraState = {
  loadStatus: "idle",
  error: null,
  meta: { page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 },
  source: "none",
  lastUpdatedAt: null,
  droppedLastLoad: 0,
};

const initialState = tasksAdapter.getInitialState(initialExtra);

export interface FetchTasksArgs {
  page: number;
  pageSize?: number;
}

export interface FetchTasksResult {
  tasks: Task[];
  meta: PageMeta;
  dropped: number;
}

export const fetchTasks = createAsyncThunk<FetchTasksResult, FetchTasksArgs>(
  "tasks/fetch",
  async ({ page, pageSize = DEFAULT_PAGE_SIZE }, { signal, rejectWithValue }) => {
    const url = `${API_BASE}/api/tasks?page=${page}&pageSize=${pageSize}`;
    let res: Response;
    try {
      res = await fetch(url, { signal });
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Network request failed",
      ) as never;
    }
    if (!res.ok) {
      return rejectWithValue(`Server responded ${res.status}`) as never;
    }
    const json: unknown = await res.json();
    const { tasks, meta, dropped } = normalizeTasksResponse(json);

    // Persist to IndexedDB off the critical path (fire-and-forget).
    void writeTasksCache({ tasks, meta, savedAt: Date.now() });

    return { tasks, meta, dropped };
  },
);

const tasksSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    /** Hydrate the store from IndexedDB. Marked stale until a fetch confirms. */
    hydrateFromCache(
      state,
      action: PayloadAction<{ tasks: Task[]; meta: PageMeta; savedAt: number }>,
    ) {
      // Do not clobber network data if a fetch already won the race.
      if (state.source === "network") return;
      tasksAdapter.setAll(state, action.payload.tasks);
      state.meta = action.payload.meta;
      state.source = "cache";
      state.lastUpdatedAt = action.payload.savedAt;
    },

    taskUpdated(state, action: PayloadAction<TaskUpdatedEvent["payload"]>) {
      const { id, status, updatedAt } = action.payload;
      const existing = state.entities[id];
      const changes: Partial<Task> = {};
      if (status !== undefined) {
        const { status: normStatus, rawStatus } = normalizeStatus(status);
        changes.status = normStatus;
        changes.rawStatus = rawStatus;
      }
      if (updatedAt !== undefined) {
        changes.updatedAt = normalizeTimestamp(updatedAt);
      }
      if (existing) {
        tasksAdapter.updateOne(state, { id, changes });
      } else {
        // Event for a task we haven't loaded: keep it as a partial stub so we
        // never drop the signal, and flag it so the UI is honest about it.
        tasksAdapter.upsertOne(state, makePartialTask(id, changes));
      }
    },

    taskAssigned(state, action: PayloadAction<TaskAssignedEvent["payload"]>) {
      const { id, assignee } = action.payload;
      const normalized: Assignee | null = normalizeAssignee(assignee);
      if (state.entities[id]) {
        tasksAdapter.updateOne(state, { id, changes: { assignee: normalized } });
      } else {
        tasksAdapter.upsertOne(state, makePartialTask(id, { assignee: normalized }));
      }
    },

    annotationCreated(state, action: PayloadAction<AnnotationCreatedEvent["payload"]>) {
      const { taskId, at } = action.payload;
      const existing = state.entities[taskId];
      if (existing) {
        tasksAdapter.updateOne(state, {
          id: taskId,
          changes: {
            annotationCount: existing.annotationCount + 1,
            updatedAt: Math.max(existing.updatedAt, normalizeTimestamp(at) || Date.now()),
          },
        });
      } else {
        tasksAdapter.upsertOne(
          state,
          makePartialTask(taskId, { annotationCount: 1, updatedAt: normalizeTimestamp(at) || Date.now() }),
        );
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.loadStatus = "loading";
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loadStatus = "succeeded";
        state.error = null;
        state.meta = action.payload.meta;
        state.source = "network";
        state.lastUpdatedAt = Date.now();
        state.droppedLastLoad = action.payload.dropped;
        // A page is authoritative for the records it contains: upsert (don't
        // wipe) so live-event stubs for other pages survive.
        tasksAdapter.upsertMany(state, action.payload.tasks);
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        // Only surface as a hard failure if we have nothing to show.
        state.loadStatus = "failed";
        state.error =
          (action.payload as string | undefined) ??
          action.error.message ??
          "Failed to load tasks";
      });
  },
});

/** Build a minimal stub for a task referenced by an event before it is loaded. */
function makePartialTask(id: string, changes: Partial<Task>): Task {
  return {
    id,
    title: id,
    type: "unknown",
    rawType: "unknown",
    status: "unknown",
    rawStatus: "unknown",
    assignee: null,
    annotationCount: 0,
    updatedAt: 0,
    meta: {},
    partial: true,
    ...changes,
  } as Task;
}

export const { hydrateFromCache, taskUpdated, taskAssigned, annotationCreated } =
  tasksSlice.actions;

export default tasksSlice.reducer;
