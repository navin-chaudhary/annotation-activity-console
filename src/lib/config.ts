/**
 * Central place for the mock-server origin. Overridable via env so the same
 * build can point at a different host, but defaults to the local mock server.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

export const DEFAULT_PAGE_SIZE = 20;
