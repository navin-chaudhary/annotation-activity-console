/**
 * useTaskSummary
 *
 * Streams the markdown summary for a task from the SSE endpoint and exposes it
 * incrementally as it arrives. We use `fetch` + a ReadableStream reader (not
 * EventSource) for two reasons:
 *   1. `AbortController` gives clean cancellation when the user switches tasks
 *      mid-stream (EventSource has no first-class cancel + auto-reconnects,
 *      which would restart this one-shot stream).
 *   2. We can parse the SSE framing ourselves and stop on the `done` event.
 *
 * Bonus: a completed summary is cached in IndexedDB, so revisiting a task
 * paints instantly instead of re-streaming.
 */
"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/config";
import { readSummaryCache, writeSummaryCache } from "@/features/persistence/cache";

export type SummaryStatus = "idle" | "loading" | "streaming" | "done" | "error";

export interface SummaryState {
  markdown: string;
  status: SummaryStatus;
  error: string | null;
  fromCache: boolean;
}

const IDLE_STATE: SummaryState = {
  markdown: "",
  status: "idle",
  error: null,
  fromCache: false,
};

/** Parse a single SSE frame into its `event` name and joined `data` payload. */
function parseSseFrame(frame: string): { event: string | null; data: string | null } {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
  }
  return { event, data: dataLines.length > 0 ? dataLines.join("\n") : null };
}

export function useTaskSummary(taskId: string | null): SummaryState {
  const [state, setState] = useState<SummaryState>(IDLE_STATE);

  useEffect(() => {
    if (!taskId) {
      setState(IDLE_STATE);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      setState({ markdown: "", status: "loading", error: null, fromCache: false });

      // 1. Instant paint from cache if we've streamed this summary before.
      const cached = await readSummaryCache(taskId);
      if (cancelled) return;
      if (cached != null) {
        setState({ markdown: cached, status: "done", error: null, fromCache: true });
        return;
      }

      // 2. Stream fresh.
      try {
        const res = await fetch(`${API_BASE}/api/tasks/${taskId}/summary`, {
          signal: controller.signal,
          headers: { Accept: "text/event-stream" },
        });
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        if (!res.body) throw new Error("Streaming not supported in this environment");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let finished = false;

        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const { event, data } = parseSseFrame(frame);
            if (event === "done") {
              finished = true;
              break;
            }
            if (data !== null) {
              // The mock JSON-encodes each chunk; fall back to raw on parse fail.
              let chunk: string;
              try {
                const parsed: unknown = JSON.parse(data);
                chunk = typeof parsed === "string" ? parsed : data;
              } catch {
                chunk = data;
              }
              acc += chunk;
              if (!cancelled) {
                setState({ markdown: acc, status: "streaming", error: null, fromCache: false });
              }
            }
          }
        }

        if (cancelled) return;
        setState({ markdown: acc, status: "done", error: null, fromCache: false });
        void writeSummaryCache(taskId, acc);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to stream summary",
        }));
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort(); // cancel an in-flight stream when task changes/unmounts
    };
  }, [taskId]);

  return state;
}
