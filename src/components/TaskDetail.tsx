"use client";

import { useAppSelector } from "@/lib/hooks";
import { selectSelectedTask } from "@/features/tasks/selectors";
import { STATUS_CLASSES, statusLabel, timeAgo, typeLabel } from "@/lib/format";
import { SummaryPanel } from "./SummaryPanel";

export function TaskDetail() {
  const task = useAppSelector(selectSelectedTask);

  if (!task) {
    return (
      <div className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        Select a task to see its details and AI summary.
      </div>
    );
  }

  const hasMeta = Object.keys(task.meta).length > 0;

  return (
    <div className="space-y-3">
      <div className="rounded border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{task.title}</h1>
            <p className="text-xs text-gray-400">{task.id}</p>
          </div>
          <span
            className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[task.status]}`}
            title={`raw status: ${task.rawStatus}`}
          >
            {statusLabel(task.status)}
          </span>
        </div>

        {task.partial && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
            This task was seen only via a live event. Its full record has not been
            loaded yet, so some fields are placeholders.
          </p>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Field label="Type">
            {typeLabel(task.type)}
            {task.type === "unknown" && task.rawType !== "unknown" && (
              <span className="ml-1 text-xs text-amber-600">(raw: {task.rawType})</span>
            )}
          </Field>
          <Field label="Assignee">
            {task.assignee ? task.assignee.name : <span className="text-gray-400">Unassigned</span>}
          </Field>
          <Field label="Annotations">{task.annotationCount}</Field>
          <Field label="Updated">{timeAgo(task.updatedAt)}</Field>
        </dl>

        {hasMeta && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Meta</p>
            <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
              {JSON.stringify(task.meta, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <SummaryPanel taskId={task.id} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-800">{children}</dd>
    </div>
  );
}
