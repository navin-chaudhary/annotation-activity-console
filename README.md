# Annotation Activity Console

An internal console for annotation tasks: a normalized, typed view of messy
backend data that updates in real time from a WebSocket feed, with an
on-demand AI summary streamed as sanitized markdown.

Stack: **Next.js (App Router) · React 18 · TypeScript (strict) · Redux Toolkit ·
Tailwind · Jest + React Testing Library**.

## Running it

You need **two** processes: the mock server (port 4000) and the app (port 3000).

```bash
# 1) Install app deps
npm install

# 2) Start the mock server (REST + WebSocket + SSE) — in its own terminal
cd mock-server
npm install
npm run mock
# -> mock on http://localhost:4000 (ws://localhost:4000/ws)

# 3) Start the app — from the repo root, in another terminal
npm run dev
# -> http://localhost:3000
```

There’s also a root shortcut for the mock once its deps are installed:

```bash
npm run mock   # runs mock-server/server.js from the repo root
```

The API/WS origins default to `localhost:4000` and can be overridden with
`NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_WS_URL`.

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the app (dev)                           |
| `npm run build`     | Production build (also runs lint + typecheck) |
| `npm test`          | Run the Jest test suite                       |
| `npm run typecheck` | `tsc --noEmit` (strict)                       |
| `npm run lint`      | ESLint (next config)                          |
| `npm run mock`      | Start the mock server                         |

## What to look at

- `src/features/tasks/normalize.ts` — raw `unknown` → clean `Task` model.
- `src/features/tasks/types.ts` — discriminated union on `type`, status enum.
- `src/features/tasks/tasksSlice.ts` — entity adapter + thunk + live-event merge.
- `src/features/tasks/selectors.ts` — memoized filtered/sorted/derived views.
- `src/features/tasks/useTaskFeed.ts` — WebSocket subscription + reconnect.
- `src/features/tasks/useTaskSummary.ts` — SSE streaming with cancel/error handling.
- `src/components/Markdown.tsx` — the safe markdown render/sanitize boundary.
- `src/features/persistence/cache.ts` — IndexedDB cache (hydrate + revalidate).
- `src/buggy/TaskTicker.tsx` — Part 2 fixes (see `DECISIONS.md`).

## Deploying (Vercel app + hosted mock)

The app is a standard Next.js app and deploys to **Vercel** with no code changes.
The catch: the **mock server is a long-lived WebSocket + SSE process, which Vercel
serverless cannot run**, so the mock must be hosted separately and the app pointed
at it. All data fetching is client-side, so the Vercel build succeeds regardless;
the app just shows an error state until it can reach a backend.

**1. Host the mock** (needs WebSocket support — Render/Railway/Fly, not Vercel).
A Render blueprint is included (`render.yaml`): New → Blueprint → pick this repo.
The mock now honors the platform's `PORT` env var (local default is still 4000).
You'll get a URL like `https://annotation-console-mock.onrender.com`.

**2. Deploy the app to Vercel.**
- If this folder isn't its own git repo, set **Root Directory = `annotation-console`**
  in the Vercel project (the framework auto-detects as Next.js).
- Add these Environment Variables, then **redeploy** (Next.js inlines
  `NEXT_PUBLIC_*` at *build time*, so a rebuild is required for them to take effect):

  | Variable                | Value                                              |
  | ----------------------- | -------------------------------------------------- |
  | `NEXT_PUBLIC_API_BASE`  | `https://<your-mock-host>`                          |
  | `NEXT_PUBLIC_WS_URL`    | `wss://<your-mock-host>/ws`                         |

> Must be `https`/`wss` (not `http`/`ws`): an HTTPS page cannot call insecure
> origins — the browser blocks it as mixed content. Seeing requests to
> `http://localhost:4000` in production means these vars weren't set at build time.

For a take-home, running locally is the intended path; a public deploy is only
needed if you want a live demo, and requires the hosted mock above.

## Things worth knowing

- The mock returns **deliberately messy** data (mixed timestamp formats, string
  counts, inconsistent status casing, unknown types, null assignees). Handling
  that is done in `normalize.ts`; nothing is silently dropped except id-less
  records, which are **counted** and surfaced in the header.
- On reload the UI paints instantly from an IndexedDB cache (marked **cached**),
  then revalidates from the network (flips to **fresh**).
- The streamed summary contains **untrusted HTML/script on purpose**. It is
  rendered as markdown but sanitized with DOMPurify — nothing executes. See the
  "Streamed markdown, rendered safely" section of `DECISIONS.md`.
- Live events for tasks beyond the loaded pages appear as **partial** rows so
  the live signal isn’t lost while staying honest about incompleteness.

See **`DECISIONS.md`** for the reasoning, trade-offs, and the bug-hunt write-up.
