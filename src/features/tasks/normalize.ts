/**
 * normalize.ts
 *
 * Turns raw, messy server payloads into the clean internal `Task` model.
 *
 * Guiding rules (see DECISIONS.md for the long version):
 *  - Never throw on bad data. A single garbage field must not crash the list.
 *  - Never silently drop data we can represent. Unknown enum values become
 *    `"unknown"` and the original is preserved (`rawType` / `rawStatus`).
 *  - The one thing we cannot keep is a record with no usable string `id`,
 *    because it can't be keyed in the entity map or targeted by live events.
 *    Those are dropped and *counted* (`dropped`) rather than ignored quietly.
 */

import type {
  Assignee,
  PageMeta,
  RawTasksResponse,
  Task,
  TaskStatus,
  TaskType,
} from "./types";

const KNOWN_TYPES: ReadonlySet<string> = new Set(["image", "audio", "text"]);

/**
 * Maps a normalized token (lowercased, alphanumerics only) to a canonical
 * status. This collapses casing/spelling variants: "in_progress" and
 * "InProgress" both normalize to the token "inprogress".
 */
const STATUS_MAP: Readonly<Record<string, TaskStatus>> = {
  todo: "todo",
  inprogress: "in_progress",
  done: "done",
  qa: "qa",
  blocked: "blocked",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A non-empty string, or the fallback. */
function normalizeString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

/**
 * Counts arrive as either a number or a numeric string. Anything else (null,
 * NaN, "abc", negative) is clamped to a safe 0.
 */
export function normalizeCount(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  }
  return 0;
}

/**
 * Timestamps arrive as epoch-ms numbers OR ISO strings OR numeric strings.
 * Everything is normalized to epoch milliseconds. Unparseable values become 0
 * (they sort as "oldest") rather than NaN, which would corrupt every sort.
 */
export function normalizeTimestamp(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const asNumber = Number(v);
    if (Number.isFinite(asNumber)) return asNumber; // numeric string, e.g. "1719600000000"
    const asDate = Date.parse(v); // ISO string
    if (Number.isFinite(asDate)) return asDate;
  }
  return 0;
}

export function normalizeType(v: unknown): { type: TaskType; rawType: string } {
  const raw = typeof v === "string" ? v : String(v);
  if (typeof v === "string" && KNOWN_TYPES.has(v.toLowerCase())) {
    return { type: v.toLowerCase() as TaskType, rawType: raw };
  }
  return { type: "unknown", rawType: raw };
}

export function normalizeStatus(v: unknown): { status: TaskStatus; rawStatus: string } {
  const raw = typeof v === "string" ? v : String(v);
  const token = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const status = STATUS_MAP[token] ?? "unknown";
  return { status, rawStatus: raw };
}

export function normalizeAssignee(v: unknown): Assignee | null {
  if (!isRecord(v)) return null; // covers the deliberate `null` case
  const { id, name } = v;
  if (typeof id === "string" && typeof name === "string") {
    return { id, name };
  }
  return null;
}

function normalizeMeta(v: unknown): Record<string, unknown> {
  return isRecord(v) ? v : {};
}

/**
 * Normalize a single raw task. Returns `null` only when there is no usable
 * `id` (the record cannot be keyed), so callers can count the drop.
 */
export function normalizeTask(raw: unknown): Task | null {
  if (!isRecord(raw)) return null;

  const id = raw.id;
  if (typeof id !== "string" || id.trim() === "") return null;

  const { type, rawType } = normalizeType(raw.type);
  const { status, rawStatus } = normalizeStatus(raw.status);

  const base = {
    id,
    title: normalizeString(raw.title, id), // fall back to id so rows are never blank
    status,
    rawStatus,
    assignee: normalizeAssignee(raw.assignee),
    annotationCount: normalizeCount(raw.annotationCount),
    updatedAt: normalizeTimestamp(raw.updatedAt),
    meta: normalizeMeta(raw.meta),
    partial: false,
  };

  // Discriminated construction keeps `rawType` only on the `unknown` variant.
  if (type === "unknown") {
    return { ...base, type, rawType };
  }
  return { ...base, type };
}

export interface NormalizedTasksResult {
  tasks: Task[];
  meta: PageMeta;
  /** Count of records dropped for having no usable id. */
  dropped: number;
}

/** Coerce the list response, tolerating missing/garbage envelope fields. */
export function normalizeTasksResponse(raw: unknown): NormalizedTasksResult {
  const envelope = isRecord(raw) ? (raw as Partial<RawTasksResponse>) : {};
  const items = Array.isArray(envelope.items) ? envelope.items : [];

  const tasks: Task[] = [];
  let dropped = 0;
  for (const item of items) {
    const task = normalizeTask(item);
    if (task) tasks.push(task);
    else dropped += 1;
  }

  const meta: PageMeta = {
    page: normalizeCount(envelope.page) || 1,
    pageSize: normalizeCount(envelope.pageSize) || tasks.length || 20,
    total: normalizeCount(envelope.total) || tasks.length,
  };

  return { tasks, meta, dropped };
}
