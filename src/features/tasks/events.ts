/**
 * Parses untrusted WebSocket frames into typed `FeedEvent`s.
 * Anything malformed returns `null` and is ignored by the caller (a bad frame
 * must never take down the live feed).
 */
import { normalizeAssignee, normalizeTimestamp } from "./normalize";
import type { FeedEvent } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseFeedEvent(data: unknown): FeedEvent | null {
  let raw: unknown = data;
  if (typeof data === "string") {
    try {
      raw = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!isRecord(raw)) return null;

  const { kind, payload } = raw;
  if (typeof kind !== "string" || !isRecord(payload)) return null;

  switch (kind) {
    case "task.updated": {
      const id = payload.id;
      if (typeof id !== "string") return null;
      return {
        kind: "task.updated",
        payload: {
          id,
          status: typeof payload.status === "string" ? payload.status : undefined,
          updatedAt:
            typeof payload.updatedAt === "number" || typeof payload.updatedAt === "string"
              ? payload.updatedAt
              : undefined,
        },
      };
    }
    case "task.assigned": {
      const id = payload.id;
      if (typeof id !== "string") return null;
      return {
        kind: "task.assigned",
        payload: { id, assignee: normalizeAssignee(payload.assignee) },
      };
    }
    case "annotation.created": {
      const taskId = payload.taskId;
      if (typeof taskId !== "string") return null;
      return {
        kind: "annotation.created",
        payload: {
          taskId,
          by: typeof payload.by === "string" ? payload.by : "unknown",
          at: normalizeTimestamp(payload.at) || Date.now(),
        },
      };
    }
    default:
      return null;
  }
}
