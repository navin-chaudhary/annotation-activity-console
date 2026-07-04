// buggy/TaskTicker.tsx  (fixed — see DECISIONS.md "Part 2: Bug hunt")
import React, { useEffect, useState } from "react";

type Task = { id: string; title: string; updatedAt: number };

export function TaskTicker({ apiBase }: { apiBase: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Bug A fix: track an actual "now" value we read in render, updated via a
  // functional setter so it advances every tick instead of freezing at 1.
  const [now, setNow] = useState<number>(() => Date.now());

  // (A) keep a running clock for "x seconds ago"
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now()); // functional/current value; no stale closure
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // (B) refetch whenever selection changes
  useEffect(() => {
    if (!selectedId) return; // Bug B1 fix: don't fetch /api/tasks/null on mount

    const controller = new AbortController();
    fetch(`${apiBase}/api/tasks/${selectedId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((t: Task) => {
        // Bug B2 fix: immutable update + de-dupe (was `prev.push(t); return prev`,
        // which mutated state, returned the same ref (no re-render), and piled
        // up duplicates on repeated selection).
        setTasks((prev) => [...prev.filter((x) => x.id !== t.id), t]);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Failed to load task", err);
      });

    // Bug B3 fix: cancel an in-flight request if selection changes again.
    return () => controller.abort();
  }, [selectedId, apiBase]); // apiBase was also a missing dependency

  // (C) newest first
  // Bug C fix: copy before sorting; `tasks.sort()` mutated React state in place.
  const sorted = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <ul>
      {sorted.map((t) => (
        // Bug D fix: stable key by id, not array index.
        <li key={t.id} onClick={() => setSelectedId(t.id)}>
          {t.title} (updated {Math.floor((now - t.updatedAt) / 1000)}s ago)
        </li>
      ))}
    </ul>
  );
}
