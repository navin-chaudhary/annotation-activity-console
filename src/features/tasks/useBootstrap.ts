/**
 * Bootstraps the console on the client:
 *  1. Immediately hydrate the store from the IndexedDB cache (instant paint).
 *  2. Fetch the current page from the network to revalidate.
 * The slice guards ensure a slow cache read never clobbers fresh network data.
 */
"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { readTasksCache } from "@/features/persistence/cache";
import { fetchTasks, hydrateFromCache } from "./tasksSlice";

export function useBootstrap(): void {
  const dispatch = useAppDispatch();
  const page = useAppSelector((s) => s.filters.page);

  useEffect(() => {
    let active = true;
    void readTasksCache().then((cache) => {
      if (active && cache) dispatch(hydrateFromCache(cache));
    });
    return () => {
      active = false;
    };
  }, [dispatch]);

  useEffect(() => {
    const promise = dispatch(fetchTasks({ page }));
    return () => {
      promise.abort();
    };
  }, [dispatch, page]);
}
