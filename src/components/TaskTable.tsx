"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { selectFilters, selectVisibleTasks } from "@/features/tasks/selectors";
import { selectTask, setSort, type SortField } from "@/features/tasks/filtersSlice";
import type { Task } from "@/features/tasks/types";
import { STATUS_CLASSES, statusLabel, timeAgo, typeLabel } from "@/lib/format";

function SortHeader({
  field,
  label,
  align = "left",
}: {
  field: SortField;
  label: string;
  align?: "left" | "right";
}) {
  const dispatch = useAppDispatch();
  const { sortField, sortDirection } = useAppSelector(selectFilters);
  const active = sortField === field;
  const arrow = active ? (sortDirection === "asc" ? "▲" : "▼") : "";
  return (
    <th
      scope="col"
      className={`cursor-pointer select-none px-3 py-2 font-medium ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-gray-900" : "text-gray-500"}`}
      onClick={() => dispatch(setSort({ field }))}
      aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
    >
      {label} <span className="text-xs">{arrow}</span>
    </th>
  );
}

function TaskRow({ task, selected }: { task: Task; selected: boolean }) {
  const dispatch = useAppDispatch();
  return (
    <tr
      onClick={() => dispatch(selectTask(task.id))}
      data-testid="task-row"
      className={`cursor-pointer border-t border-gray-100 hover:bg-gray-50 ${
        selected ? "bg-blue-50" : ""
      }`}
    >
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900">{task.title}</div>
        <div className="text-xs text-gray-400">{task.id}</div>
      </td>
      <td className="px-3 py-2 text-gray-600">
        {typeLabel(task.type)}
        {task.type === "unknown" && task.rawType !== "unknown" && (
          <span className="ml-1 text-xs text-amber-600">({task.rawType})</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[task.status]}`}
          title={`raw: ${task.rawStatus}`}
        >
          {statusLabel(task.status)}
        </span>
      </td>
      <td className="px-3 py-2 text-gray-600">
        {task.assignee ? task.assignee.name : <span className="text-gray-400">Unassigned</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{task.annotationCount}</td>
      <td className="px-3 py-2 text-right text-gray-500">
        {timeAgo(task.updatedAt)}
        {task.partial && (
          <span
            className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
            title="Seen only via a live event; full record not loaded yet"
          >
            partial
          </span>
        )}
      </td>
    </tr>
  );
}

export function TaskTable() {
  const tasks = useAppSelector(selectVisibleTasks);
  const selectedId = useAppSelector((s) => s.filters.selectedId);

  if (tasks.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        No tasks match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide">
          <tr>
            <SortHeader field="title" label="Task" />
            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500">
              Type
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500">
              Status
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500">
              Assignee
            </th>
            <SortHeader field="annotationCount" label="Annots" align="right" />
            <SortHeader field="updatedAt" label="Updated" align="right" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} selected={task.id === selectedId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
