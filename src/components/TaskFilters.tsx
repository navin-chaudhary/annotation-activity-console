"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { selectFilters } from "@/features/tasks/selectors";
import {
  setSearch,
  setStatusFilter,
  setTypeFilter,
  type StatusFilter,
  type TypeFilter,
} from "@/features/tasks/filtersSlice";
import type { TaskStatus, TaskType } from "@/features/tasks/types";
import { statusLabel, typeLabel } from "@/lib/format";

const TYPE_OPTIONS: TaskType[] = ["image", "audio", "text", "unknown"];
const STATUS_OPTIONS: TaskStatus[] = [
  "todo",
  "in_progress",
  "qa",
  "done",
  "blocked",
  "unknown",
];

export function TaskFilters() {
  const dispatch = useAppDispatch();
  const { type, status, search } = useAppSelector(selectFilters);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        value={search}
        onChange={(e) => dispatch(setSearch(e.target.value))}
        placeholder="Search title, id, assignee…"
        aria-label="Search tasks"
        className="w-56 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />

      <label className="flex items-center gap-1.5 text-sm text-gray-600">
        Type
        <select
          value={type}
          onChange={(e) => dispatch(setTypeFilter(e.target.value as TypeFilter))}
          aria-label="Filter by type"
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-sm text-gray-600">
        Status
        <select
          value={status}
          onChange={(e) => dispatch(setStatusFilter(e.target.value as StatusFilter))}
          aria-label="Filter by status"
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
