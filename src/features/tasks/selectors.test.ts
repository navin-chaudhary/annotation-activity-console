import { makeStore } from "@/lib/store";
import { hydrateFromCache } from "./tasksSlice";
import { setSort, setStatusFilter, setTypeFilter } from "./filtersSlice";
import { normalizeTask } from "./normalize";
import { selectStatusCounts, selectVisibleTasks } from "./selectors";
import type { Task } from "./types";

function seed(): Task[] {
  return [
    normalizeTask({ id: "t1", title: "Alpha", type: "image", status: "done", annotationCount: 5, updatedAt: 100 }),
    normalizeTask({ id: "t2", title: "Bravo", type: "audio", status: "todo", annotationCount: 2, updatedAt: 300 }),
    normalizeTask({ id: "t3", title: "Charlie", type: "image", status: "in_progress", annotationCount: 9, updatedAt: 200 }),
  ].filter((t): t is Task => t !== null);
}

function makeSeededStore() {
  const store = makeStore();
  store.dispatch(hydrateFromCache({ tasks: seed(), meta: { page: 1, pageSize: 20, total: 3 }, savedAt: Date.now() }));
  return store;
}

describe("selectVisibleTasks", () => {
  it("sorts by updatedAt desc by default", () => {
    const store = makeSeededStore();
    const ids = selectVisibleTasks(store.getState()).map((t) => t.id);
    expect(ids).toEqual(["t2", "t3", "t1"]);
  });

  it("filters by type", () => {
    const store = makeSeededStore();
    store.dispatch(setTypeFilter("image"));
    const ids = selectVisibleTasks(store.getState()).map((t) => t.id);
    expect(ids).toEqual(["t3", "t1"]);
  });

  it("filters by status", () => {
    const store = makeSeededStore();
    store.dispatch(setStatusFilter("todo"));
    const ids = selectVisibleTasks(store.getState()).map((t) => t.id);
    expect(ids).toEqual(["t2"]);
  });

  it("re-sorts when the sort field changes", () => {
    const store = makeSeededStore();
    store.dispatch(setSort({ field: "annotationCount", direction: "desc" }));
    const ids = selectVisibleTasks(store.getState()).map((t) => t.id);
    expect(ids).toEqual(["t3", "t1", "t2"]);
  });
});

describe("selectStatusCounts", () => {
  it("buckets loaded tasks by status", () => {
    const store = makeSeededStore();
    const counts = selectStatusCounts(store.getState());
    expect(counts.done).toBe(1);
    expect(counts.todo).toBe(1);
    expect(counts.in_progress).toBe(1);
    expect(counts.blocked).toBe(0);
  });
});
