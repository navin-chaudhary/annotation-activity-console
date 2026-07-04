import type { TaskStatus, TaskType } from "@/features/tasks/types";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  qa: "QA",
  done: "Done",
  blocked: "Blocked",
  unknown: "Unknown",
};

export function statusLabel(status: TaskStatus): string {
  return STATUS_LABELS[status];
}

const TYPE_LABELS: Record<TaskType, string> = {
  image: "Image",
  audio: "Audio",
  text: "Text",
  unknown: "Unknown",
};

export function typeLabel(type: TaskType): string {
  return TYPE_LABELS[type];
}

/** Tailwind classes per status for the little pills. Visual only. */
export const STATUS_CLASSES: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  qa: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  unknown: "bg-amber-100 text-amber-800",
};

export function timeAgo(epochMs: number, now: number = Date.now()): string {
  if (!epochMs) return "unknown";
  const diff = Math.max(0, now - epochMs);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
