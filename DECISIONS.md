# DECISIONS

Short and honest. This is the doc to interview from.

## Architecture at a glance

- **Data path:** `fetch` → `normalize.ts` (raw `unknown` → clean `Task`) → `createEntityAdapter` cache → memoized selectors → components. Components never read raw state.
- **Three writers, one cache:** the REST page fetch, the live WebSocket feed, and the IndexedDB hydration all `upsert` into the *same* entity map. This is the core reason for the state design below.

## State: RTK thunks + entity adapter (not RTK Query)

I used a hand-written `createAsyncThunk` plus `createEntityAdapter`, not RTK Query.

- The app’s hard part is **merging three sources into one normalized cache**. Owning the entity map makes those merges explicit: `fetchTasks.fulfilled` does `upsertMany`, WS events do `updateOne`/`upsertOne`, cache hydration does `setAll`. With RTK Query I’d be reaching into its cache via `updateQueryData` from a socket, plus doing normalization in `transformResponse`, which is more indirection for this shape of problem.
- Normalization is non-trivial and needs to run in exactly one place before anything hits the store. A thunk gives a clean seam for that.
- **Trade-off I’m accepting:** I gave up RTK Query’s free request dedup/caching/refetch machinery. For a single list endpoint + a stream that’s a small cost, and I’d revisit RTK Query if the API surface grew.

`filtersSlice` (filters/search/sort/selection/pagination) is kept separate from the entity cache so re-filtering never touches task data.

## Typing the messy data

Domain model in `features/tasks/types.ts`:

- **`Task` is a discriminated union on `type`** (`image | audio | text | unknown`). Only the `unknown` variant carries `rawType`, so an unrecognized `"video"` is preserved rather than dropped, and the compiler forces callers to handle the `unknown` case.
- **`status` is a normalized enum** (`todo | in_progress | qa | done | blocked | unknown`). Casing/spelling variants collapse via a normalized token (`lowercase` + strip non-alphanumerics): `"in_progress"` and `"InProgress"` both become the token `inprogress`. The original is kept as `rawStatus` (shown in a tooltip).
- Raw input to the normalizer is typed as `unknown` (via record narrowing), which forces narrowing instead of trusting the wire. **No `any`.** The only casts are: (a) `marked.parse(..., { async:false }) as string` — justified because disabling async guarantees a synchronous string; (b) `as Task` when constructing a partial stub for an event-only task, because a spread over a union can’t be proven exhaustive by the compiler but the object is fully specified.

### Normalization rules (`normalize.ts`)

- **Timestamps** → epoch ms. Handles epoch-ms numbers, ISO strings, and numeric strings. Unparseable → `0` (sorts as oldest) rather than `NaN`, which would poison every sort.
- **Counts** → non-negative integers. Numeric strings parse; `"abc"`, `null`, negatives → `0`.
- **Assignee** → `{id,name}` only when both are strings, else `null` (covers the intentional `null`).
- **Meta** → kept as `Record<string, unknown>`; free-form, never trusted for shape.
- **Missing title** → falls back to the `id` so rows are never blank.
- **The one drop:** a record with no usable string `id` is dropped, because it can’t be keyed in the entity map or targeted by an event. Drops are **counted** (`dropped`) and surfaced in the header — not silent.

## Real-time merge strategy (`useTaskFeed`)

- One WebSocket, events parsed by `events.ts` into typed `FeedEvent`s; a malformed frame returns `null` and is ignored (a bad frame must not kill the feed).
- **`task.updated` / `task.assigned`:** if the task exists, `updateOne`; if not, `upsertOne` a **partial stub** flagged `partial: true`. This is how I handle “event references a task you haven’t loaded”: nothing is dropped, and the UI honestly labels the row/detail as *partial* (seen only via a live event).
- **`annotation.created`:** increments `annotationCount` and bumps `updatedAt`.
- **Reconnect:** capped exponential backoff (1s → 15s). A `disposedRef` guard + detaching handlers on cleanup prevents the teardown `close()` from scheduling a reconnect, and makes React 18 StrictMode double-mount safe.

## Streamed markdown, rendered safely

- **Transport:** `fetch` + `ReadableStream` reader, **not `EventSource`**. Reasons: `AbortController` gives clean cancellation when switching tasks mid-stream (EventSource has no first-class cancel and auto-reconnects, which would restart this one-shot stream), and I can parse the SSE framing and stop on the `done` event myself.
- **Incremental render:** each parsed chunk is appended and `setState`’d, so the summary visibly builds up. A blinking caret shows while `streaming`.
- **Cancellation / errors:** switching tasks or unmounting calls `controller.abort()`; the aborted request is swallowed (not shown as an error). A non-OK response or stream failure sets `status: "error"` and renders a visible message.
- **Sanitization — the exact boundary:** `Markdown.tsx` does `markdown → marked (HTML) → DOMPurify.sanitize → dangerouslySetInnerHTML`. **DOMPurify is the single, mandatory boundary.** It strips `<script>`, inline event handlers (`onerror`, …), and `javascript:` URLs, restricted to the HTML profile. On top of the defaults I explicitly `FORBID_TAGS` for `script/style/iframe/object/embed/img/svg/math`. Forbidding `<img>` (and friends) is deliberate: untrusted summaries have no legitimate reason to load remote resources, and allowing them lets injected markup fire **outbound requests** — the mock's `<img src=x onerror=...>` would otherwise both attempt an `onerror` (stripped) *and* request `"x"` (a tracking/SSRF/pixel side channel). Blocking the tag removes that whole class of side effect. `Markdown.test.tsx` asserts the output contains no `onerror`, no `<script>`, and no `<img>`, while still rendering the markdown and code blocks.

## IndexedDB caching (`persistence/cache.ts`, via localforage)

- **What:** the most recently loaded task list (`{ tasks, meta, savedAt }`) under one key; plus (bonus) completed summaries per task id.
- **When:** written fire-and-forget from `fetchTasks.fulfilled` (off the main thread — IndexedDB is async), so it never blocks render. Read on startup in `useBootstrap`.
- **Flow:** hydrate from cache → paint immediately with `source: "cache"` and a visible “Showing cached data… Revalidating” banner → network response flips `source: "network"` and shows a “fresh” badge.
- **Avoiding stale-data bugs:** `hydrateFromCache` **bails if `source === "network"`** already, so a slow cache read can never clobber fresh data that won a race. Network fulfillment uses `upsertMany` (not `setAll`), so live-event stubs for other pages survive a refresh. All cache access is SSR-safe (no-op without `window`/IndexedDB) and wrapped in try/catch so a corrupt cache or quota error degrades to network-only instead of crashing.

## Messy/edge data: handled vs. deliberately not

Handled: mixed timestamp formats, string/garbage counts, inconsistent status casing/spelling, unknown `type`, `null` assignee, missing title, malformed list envelope, id-less records (counted), malformed WS frames, events for unloaded tasks, slow-page loading states, stream errors, WS reconnect.

Deliberately not (scoped out, with reasoning):

- **Server-side filtering/sorting:** the mock paginates but ignores `type`/`status` params, so filter/search/sort run **client-side over the loaded (accumulated) set**. In production these predicates belong on the server; I’d push them down and treat the client filter as a refinement.
- **Optimistic “assign to me”:** the mock has no write endpoint, so a real optimistic+rollback flow would be simulated theatre. I left it out rather than fake it. (Design would be: optimistic `updateOne`, keep the previous value, roll back on rejection.)
- **Virtualization / redux-persist:** not needed at 137 rows; noted as next steps.
- **Timestamp-garbage policy:** I chose `0` (oldest) over dropping. Debatable; documented so it’s a decision, not an accident.

## Part 2: Bug hunt (`src/buggy/TaskTicker.tsx`)

1. **Stale-closure clock (A).** `setTick(tick + 1)` closed over `tick = 0` from the run-once effect, so it always set `1`; React then bailed out of re-renders (same value) and the “x seconds ago” clock froze. Worse, `tick` was never read in render. **Fix:** keep a `now` value that render actually uses, updated with a functional setter (`setNow(Date.now())`). Correct because it no longer depends on a stale captured value and the displayed value truly changes each second.
2. **Fetch on null selection (B1).** On mount `selectedId` is `null`, so it fetched `/api/tasks/null` (a 404). **Fix:** guard `if (!selectedId) return;`. Correct because there is nothing to fetch until a task is selected.
3. **State mutation / no re-render / duplicates (B2).** `prev.push(t); return prev;` mutated the existing array and returned the **same reference**, so React often didn’t re-render, and re-selecting a task appended duplicates. **Fix:** return a new array and de-dupe by id (`[...prev.filter(x => x.id !== t.id), t]`). Correct because immutable updates are what React’s change detection relies on, and de-dupe keeps the list a set by id.
4. **Sorting mutates state (C).** `tasks.sort(...)` sorts **in place**, mutating React state during render. **Fix:** copy first (`[...tasks].sort(...)`). Correct because render must be pure; sorting a copy leaves state untouched.
5. **Index as key (D).** `key={i}` ties React’s identity to position, causing incorrect reconciliation/state when the list reorders (and it does — it’s sorted). **Fix:** `key={t.id}`, a stable identity.
6. **Missing effect deps + request race (bonus, found beyond the planted set).** The fetch effect used `apiBase` but only listed `[selectedId]`, and fast selection changes could let an older response overwrite a newer one. **Fix:** add `apiBase` to deps and use an `AbortController` to cancel the in-flight request on change/unmount.

## What I’d do next with more time

- Push filtering/sorting/pagination to the server (or adopt RTK Query) once the API supports it.
- Lazy-fetch full records for `partial` stubs so event-only tasks fill in.
- Real optimistic assign with rollback (needs a write endpoint), redux-persist for filter/UI state, list virtualization.
- A few more tests: the WS reducer paths (partial upsert), and the streaming hook’s cancel-on-switch behavior.

## AI usage & verification

I used an AI assistant to scaffold boilerplate (config files, repetitive Tailwind, test skeletons) and to draft this doc. I verified everything by: running `tsc --noEmit` (strict), `next build` (lint + types), `jest` (27 tests incl. normalizer, selector, filtering interaction, and sanitization), and by exercising the live mock server (REST payload shape, SSE stream contents, WS events). I wrote and reviewed the domain model, normalizer, merge logic, streaming/sanitization path, and the bug fixes myself — those are the parts I’d expect to defend line-by-line.
