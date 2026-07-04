/**
 * Client-side persistence via IndexedDB (localforage).
 *
 * We cache the most recently loaded task list so a reload paints instantly from
 * cache, then revalidates from the network. Writes are async and land on
 * IndexedDB (off the main thread), and are fired-and-forgotten from the thunk
 * so they never block rendering.
 *
 * All access is SSR-safe: on the server (no window/IndexedDB) every call is a
 * no-op, so importing this never crashes during Next.js server rendering.
 */
import type LocalForage from "localforage";
import type { PageMeta, Task } from "@/features/tasks/types";

export interface TasksCache {
  tasks: Task[];
  meta: PageMeta;
  /** epoch ms when the cache was written; drives the "stale since" label. */
  savedAt: number;
}

const TASKS_KEY = "tasks:list";
const SUMMARY_PREFIX = "summary:";

let storePromise: Promise<LocalForage | null> | null = null;

function hasIndexedDB(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

/** Lazily import + configure localforage only in the browser. */
async function getStore(): Promise<LocalForage | null> {
  if (!hasIndexedDB()) return null;
  if (!storePromise) {
    storePromise = import("localforage").then((mod) => {
      const lf = mod.default;
      lf.config({
        name: "annotation-console",
        storeName: "tasks_cache",
        description: "Cached task list + streamed summaries",
      });
      return lf;
    });
  }
  return storePromise;
}

export async function readTasksCache(): Promise<TasksCache | null> {
  const store = await getStore();
  if (!store) return null;
  try {
    return (await store.getItem<TasksCache>(TASKS_KEY)) ?? null;
  } catch {
    return null; // a corrupt cache must never break startup
  }
}

export async function writeTasksCache(cache: TasksCache): Promise<void> {
  const store = await getStore();
  if (!store) return;
  try {
    await store.setItem(TASKS_KEY, cache);
  } catch {
    // Out of quota / private mode: degrade silently, network still works.
  }
}

// --- Bonus: cache streamed summaries so a revisited task shows instantly. ---

export async function readSummaryCache(taskId: string): Promise<string | null> {
  const store = await getStore();
  if (!store) return null;
  try {
    return (await store.getItem<string>(SUMMARY_PREFIX + taskId)) ?? null;
  } catch {
    return null;
  }
}

export async function writeSummaryCache(taskId: string, markdown: string): Promise<void> {
  const store = await getStore();
  if (!store) return;
  try {
    await store.setItem(SUMMARY_PREFIX + taskId, markdown);
  } catch {
    // ignore
  }
}
