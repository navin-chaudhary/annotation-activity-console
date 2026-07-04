/**
 * useTaskFeed
 *
 * Subscribes to the live WebSocket feed and dispatches typed events into the
 * store. Handles reconnection with capped exponential backoff. Events that
 * reference a task we have not loaded are handled downstream in the slice
 * (a partial stub is upserted) — nothing is dropped.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/lib/hooks";
import { WS_URL } from "@/lib/config";
import { parseFeedEvent } from "./events";
import { annotationCreated, taskAssigned, taskUpdated } from "./tasksSlice";

export type FeedStatus = "connecting" | "open" | "reconnecting" | "closed";

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 1_000;

export function useTaskFeed(): { status: FeedStatus } {
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<FeedStatus>("connecting");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  // Guards against reconnecting after the component has unmounted.
  const disposedRef = useRef(false);

  const connect = useCallback(() => {
    if (disposedRef.current) return;

    setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      scheduleReconnect();
      return;
    }
    socketRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setStatus("open");
    };

    ws.onmessage = (event) => {
      const parsed = parseFeedEvent(event.data);
      if (!parsed) return; // malformed frame: ignore, keep the feed alive
      switch (parsed.kind) {
        case "task.updated":
          dispatch(taskUpdated(parsed.payload));
          break;
        case "task.assigned":
          dispatch(taskAssigned(parsed.payload));
          break;
        case "annotation.created":
          dispatch(annotationCreated(parsed.payload));
          break;
      }
    };

    ws.onerror = () => {
      // onclose fires after onerror; reconnect is scheduled there.
      ws.close();
    };

    ws.onclose = () => {
      socketRef.current = null;
      if (!disposedRef.current) scheduleReconnect();
    };

    function scheduleReconnect() {
      if (disposedRef.current) return;
      setStatus("reconnecting");
      const delay = Math.min(
        BASE_BACKOFF_MS * 2 ** attemptRef.current,
        MAX_BACKOFF_MS,
      );
      attemptRef.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    }
  }, [dispatch]);

  useEffect(() => {
    disposedRef.current = false;
    connect();

    return () => {
      disposedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      const ws = socketRef.current;
      if (ws) {
        // Detach handlers so the teardown close does not trigger a reconnect.
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
      setStatus("closed");
    };
  }, [connect]);

  return { status };
}
