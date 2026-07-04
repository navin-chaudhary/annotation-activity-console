/**
 * Memoized selectors. UI components read ONLY from here, never from raw state,
 * so the derived/filtered/sorted view is computed in one place and cached.
 */
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/lib/store";
import { tasksAdapter } from "./tasksSlice";
import type { FiltersState } from "./filtersSlice";
import type { Task, TaskStatus } from "./types";

const adapterSelectors = tasksAdapter.getSelectors<RootState>((state) => state.tasks);

export const selectAllTasks = adapterSelectors.selectAll;
export const selectTaskEntities = adapterSelectors.selectEntities;
export const selectLoadedCount = adapterSelectors.selectTotal;
export const selectTaskById = (state: RootState, id: string): Task | undefined =>
  adapterSelectors.selectById(state, id);

export const selectFilters = (state: RootState): FiltersState => state.filters;
export const selectSelectedId = (state: RootState): string | null =>
  state.filters.selectedId;

export const selectTasksMeta = (state: RootState) => state.tasks.meta;
export const selectLoadStatus = (state: RootState) => state.tasks.loadStatus;
export const selectTasksError = (state: RootState) => state.tasks.error;
export const selectDataSource = (state: RootState) => state.tasks.source;
export const selectLastUpdatedAt = (state: RootState) => state.tasks.lastUpdatedAt;
export const selectDroppedLastLoad = (state: RootState) => state.tasks.droppedLastLoad;

function matchesSearch(task: Task, query: string): boolean {
  if (query === "") return true;
  const q = query.toLowerCase();
  return (
    task.title.toLowerCase().includes(q) ||
    task.id.toLowerCase().includes(q) ||
    (task.assignee?.name.toLowerCase().includes(q) ?? false)
  );
}

/**
 * The single filtered + sorted view over every loaded task.
 * Recomputes only when the task list or the filter/sort inputs change.
 */
export const selectVisibleTasks = createSelector(
  [selectAllTasks, selectFilters],
  (tasks, filters): Task[] => {
    const { type, status, search, sortField, sortDirection } = filters;

    const filtered = tasks.filter((task) => {
      if (type !== "all" && task.type !== type) return false;
      if (status !== "all" && task.status !== status) return false;
      if (!matchesSearch(task, search)) return false;
      return true;
    });

    const dir = sortDirection === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      switch (sortField) {
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "annotationCount":
          return (a.annotationCount - b.annotationCount) * dir;
        case "updatedAt":
        default:
          return (a.updatedAt - b.updatedAt) * dir;
      }
    });

    return sorted;
  },
);

export const selectVisibleCount = createSelector(
  [selectVisibleTasks],
  (tasks) => tasks.length,
);

export const selectSelectedTask = createSelector(
  [selectTaskEntities, selectSelectedId],
  (entities, id): Task | undefined => (id ? entities[id] : undefined),
);

/** Small derived metric: how many loaded tasks sit in each status bucket. */
export const selectStatusCounts = createSelector(
  [selectAllTasks],
  (tasks): Record<TaskStatus, number> => {
    const counts: Record<TaskStatus, number> = {
      todo: 0,
      in_progress: 0,
      qa: 0,
      done: 0,
      blocked: 0,
      unknown: 0,
    };
    for (const task of tasks) counts[task.status] += 1;
    return counts;
  },
);
