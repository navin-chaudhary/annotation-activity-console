"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useBootstrap } from "@/features/tasks/useBootstrap";
import { useTaskFeed, type FeedStatus } from "@/features/tasks/useTaskFeed";
import {
  fetchTasks,
} from "@/features/tasks/tasksSlice";
import { setPage } from "@/features/tasks/filtersSlice";
import {
  selectDataSource,
  selectDroppedLastLoad,
  selectLastUpdatedAt,
  selectLoadStatus,
  selectLoadedCount,
  selectTasksError,
  selectTasksMeta,
  selectVisibleCount,
} from "@/features/tasks/selectors";
import { timeAgo } from "@/lib/format";
import { TaskFilters } from "./TaskFilters";
import { TaskTable } from "./TaskTable";
import { TaskDetail } from "./TaskDetail";
import { StatusChart } from "./StatusChart";

export function Console() {
  useBootstrap();
  const { status: feedStatus } = useTaskFeed();

  const dispatch = useAppDispatch();
  const loadStatus = useAppSelector(selectLoadStatus);
  const error = useAppSelector(selectTasksError);
  const source = useAppSelector(selectDataSource);
  const lastUpdatedAt = useAppSelector(selectLastUpdatedAt);
  const meta = useAppSelector(selectTasksMeta);
  const loadedCount = useAppSelector(selectLoadedCount);
  const visibleCount = useAppSelector(selectVisibleCount);
  const dropped = useAppSelector(selectDroppedLastLoad);
  const page = useAppSelector((s) => s.filters.page);

  const hasData = loadedCount > 0;
  const isInitialLoading = loadStatus === "loading" && !hasData;
  const isHardError = loadStatus === "failed" && !hasData;
  const canLoadMore = page * meta.pageSize < meta.total;

  return (
    <main className="mx-auto max-w-7xl p-4">
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900">Annotation Activity Console</h1>
          <div className="flex items-center gap-2 text-xs">
            <FeedBadge status={feedStatus} />
            <FreshnessBadge source={source} lastUpdatedAt={lastUpdatedAt} loading={loadStatus === "loading"} />
          </div>
        </div>
        {source === "cache" && (
          <p className="mt-1 text-xs text-amber-700">
            Showing cached data{lastUpdatedAt ? ` from ${timeAgo(lastUpdatedAt)}` : ""}. Revalidating…
          </p>
        )}
        {dropped > 0 && (
          <p className="mt-1 text-xs text-amber-700">
            {dropped} record(s) from the last load were dropped (no usable id).
          </p>
        )}
        {error && hasData && (
          <p className="mt-1 text-xs text-red-600">Live refresh failed: {error}. Showing last known data.</p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="mb-3 flex flex-col gap-3">
            <TaskFilters />
            <StatusChart />
          </div>

          {isInitialLoading ? (
            <LoadingSkeleton />
          ) : isHardError ? (
            <ErrorState message={error ?? "Failed to load tasks"} onRetry={() => dispatch(fetchTasks({ page: 1 }))} />
          ) : (
            <>
              <TaskTable />
              <footer className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Showing {visibleCount} of {loadedCount} loaded · {meta.total} total on server
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch(fetchTasks({ page: 1 }))}
                    className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-100"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    disabled={!canLoadMore || loadStatus === "loading"}
                    onClick={() => dispatch(setPage(page + 1))}
                    className="rounded border border-gray-300 px-2 py-1 enabled:hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadStatus === "loading" ? "Loading…" : "Load more"}
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>

        <aside className="lg:col-span-2">
          <TaskDetail />
        </aside>
      </div>
    </main>
  );
}

function FeedBadge({ status }: { status: FeedStatus }) {
  const map: Record<FeedStatus, { label: string; cls: string }> = {
    connecting: { label: "connecting", cls: "bg-amber-100 text-amber-800" },
    open: { label: "live", cls: "bg-green-100 text-green-700" },
    reconnecting: { label: "reconnecting", cls: "bg-amber-100 text-amber-800" },
    closed: { label: "offline", cls: "bg-gray-200 text-gray-600" },
  };
  const item = map[status];
  return (
    <span className={`flex items-center gap-1 rounded px-2 py-1 font-medium ${item.cls}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {item.label}
    </span>
  );
}

function FreshnessBadge({
  source,
  lastUpdatedAt,
  loading,
}: {
  source: string;
  lastUpdatedAt: number | null;
  loading: boolean;
}) {
  if (loading && source !== "network") {
    return <span className="rounded bg-blue-100 px-2 py-1 font-medium text-blue-700">loading…</span>;
  }
  if (source === "network") {
    return (
      <span className="rounded bg-green-100 px-2 py-1 font-medium text-green-700">
        fresh{lastUpdatedAt ? ` · ${timeAgo(lastUpdatedAt)}` : ""}
      </span>
    );
  }
  if (source === "cache") {
    return <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-800">cached</span>;
  }
  return null;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading tasks">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-gray-200" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      <p className="mt-1 text-xs text-red-600">Is the mock server running on :4000?</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  );
}
