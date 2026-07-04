"use client";

import { useAppSelector } from "@/lib/hooks";
import { selectStatusCounts } from "@/features/tasks/selectors";
import { STATUS_CLASSES, statusLabel } from "@/lib/format";
import type { TaskStatus } from "@/features/tasks/types";

const ORDER: TaskStatus[] = ["todo", "in_progress", "qa", "done", "blocked", "unknown"];

/** Tiny derived-metric view: loaded tasks per status. Updates live with events. */
export function StatusChart() {
  const counts = useAppSelector(selectStatusCounts);
  const max = Math.max(1, ...ORDER.map((s) => counts[s]));

  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Loaded tasks by status
      </h2>
      <div className="space-y-1.5">
        {ORDER.map((status) => (
          <div key={status} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-gray-600">{statusLabel(status)}</span>
            <div className="h-3 flex-1 rounded bg-gray-100">
              <div
                className={`h-3 rounded ${STATUS_CLASSES[status]}`}
                style={{ width: `${(counts[status] / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-gray-700">{counts[status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
