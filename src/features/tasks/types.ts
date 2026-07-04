/**
 * Domain model for the Annotation Activity Console.
 *
 * The server sends deliberately messy data (see mock-server). Everything the
 * rest of the app consumes goes through `normalize.ts` and conforms to the
 * clean types below. Raw shapes are typed as `unknown`-ish records so the
 * normalizer is forced to narrow instead of trusting the wire.
 */

/** Normalized, canonical task status. `unknown` is used, never dropped. */
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "qa"
  | "done"
  | "blocked"
  | "unknown";

/** The four canonical media types. `unknown` covers anything else (e.g. "video"). */
export type TaskType = "image" | "audio" | "text" | "unknown";

export interface Assignee {
  id: string;
  name: string;
}

/** Fields shared by every task variant. */
interface TaskBase {
  id: string;
  title: string;
  status: TaskStatus;
  /** Original status string exactly as received, kept for debugging/honesty. */
  rawStatus: string;
  assignee: Assignee | null;
  annotationCount: number;
  /** Always normalized to epoch milliseconds. */
  updatedAt: number;
  /** Free-form server metadata; kept as-is, never trusted for shape. */
  meta: Record<string, unknown>;
  /**
   * True when the task was created from a live event referencing an id we had
   * not loaded yet. The UI surfaces this so we never silently show a stub as
   * if it were a fully-loaded record.
   */
  partial: boolean;
}

export interface ImageTask extends TaskBase {
  type: "image";
}
export interface AudioTask extends TaskBase {
  type: "audio";
}
export interface TextTask extends TaskBase {
  type: "text";
}
export interface UnknownTask extends TaskBase {
  type: "unknown";
  /** The original, unrecognized type string (e.g. "video"), preserved. */
  rawType: string;
}

/** Discriminated union on `type`. */
export type Task = ImageTask | AudioTask | TextTask | UnknownTask;

/** Raw list response from GET /api/tasks. */
export interface RawTasksResponse {
  page: number;
  pageSize: number;
  total: number;
  items: unknown[];
}

/** Normalized page metadata. */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Live WebSocket events
// ---------------------------------------------------------------------------

export interface TaskUpdatedEvent {
  kind: "task.updated";
  payload: {
    id: string;
    status?: string;
    updatedAt?: number | string;
  };
}

export interface TaskAssignedEvent {
  kind: "task.assigned";
  payload: {
    id: string;
    assignee: Assignee | null;
  };
}

export interface AnnotationCreatedEvent {
  kind: "annotation.created";
  payload: {
    taskId: string;
    by: string;
    at: number | string;
  };
}

export type FeedEvent =
  | TaskUpdatedEvent
  | TaskAssignedEvent
  | AnnotationCreatedEvent;

export type FeedEventKind = FeedEvent["kind"];
