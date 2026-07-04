"use client";

import { useTaskSummary } from "@/features/tasks/useTaskSummary";
import { Markdown } from "./Markdown";

export function SummaryPanel({ taskId }: { taskId: string }) {
  const { markdown, status, error, fromCache } = useTaskSummary(taskId);

  return (
    <section className="rounded border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          AI Summary
        </h2>
        <StatusPill status={status} fromCache={fromCache} />
      </div>

      {status === "error" ? (
        <p className="text-sm text-red-600">Could not load summary: {error}</p>
      ) : status === "loading" && markdown === "" ? (
        <p className="animate-pulse text-sm text-gray-400">Requesting summary…</p>
      ) : (
        <>
          <Markdown content={markdown} />
          {status === "streaming" && (
            <span className="mt-1 inline-block h-4 w-2 animate-pulse bg-gray-400 align-middle" />
          )}
        </>
      )}
    </section>
  );
}

function StatusPill({
  status,
  fromCache,
}: {
  status: ReturnType<typeof useTaskSummary>["status"];
  fromCache: boolean;
}) {
  if (fromCache) {
    return (
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
        cached
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string }> = {
    loading: { label: "requesting", cls: "bg-blue-100 text-blue-700" },
    streaming: { label: "streaming", cls: "bg-blue-100 text-blue-700" },
    done: { label: "complete", cls: "bg-green-100 text-green-700" },
    error: { label: "error", cls: "bg-red-100 text-red-700" },
    idle: { label: "idle", cls: "bg-gray-100 text-gray-600" },
  };
  const item = map[status] ?? map.idle;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${item!.cls}`}>
      {item!.label}
    </span>
  );
}
