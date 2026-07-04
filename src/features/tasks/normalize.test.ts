import {
  normalizeAssignee,
  normalizeCount,
  normalizeStatus,
  normalizeTask,
  normalizeTasksResponse,
  normalizeTimestamp,
  normalizeType,
} from "./normalize";

describe("normalizeType", () => {
  it("maps known types case-insensitively", () => {
    expect(normalizeType("image")).toEqual({ type: "image", rawType: "image" });
    expect(normalizeType("AUDIO")).toEqual({ type: "audio", rawType: "AUDIO" });
  });

  it("maps unknown types to 'unknown' but preserves the raw value", () => {
    expect(normalizeType("video")).toEqual({ type: "unknown", rawType: "video" });
    expect(normalizeType(undefined)).toEqual({ type: "unknown", rawType: "undefined" });
  });
});

describe("normalizeStatus", () => {
  it("collapses casing/spelling variants", () => {
    expect(normalizeStatus("in_progress").status).toBe("in_progress");
    expect(normalizeStatus("InProgress").status).toBe("in_progress");
    expect(normalizeStatus("QA").status).toBe("qa");
    expect(normalizeStatus("BLOCKED").status).toBe("blocked");
    expect(normalizeStatus("done").status).toBe("done");
    expect(normalizeStatus("todo").status).toBe("todo");
  });

  it("falls back to 'unknown' and keeps the raw string", () => {
    expect(normalizeStatus("weird-thing")).toEqual({
      status: "unknown",
      rawStatus: "weird-thing",
    });
  });
});

describe("normalizeCount", () => {
  it("accepts numbers and numeric strings", () => {
    expect(normalizeCount(12)).toBe(12);
    expect(normalizeCount("12")).toBe(12);
  });

  it("clamps garbage and negatives to 0", () => {
    expect(normalizeCount("abc")).toBe(0);
    expect(normalizeCount(-5)).toBe(0);
    expect(normalizeCount(null)).toBe(0);
    expect(normalizeCount(3.9)).toBe(3);
  });
});

describe("normalizeTimestamp", () => {
  it("passes through epoch ms numbers", () => {
    expect(normalizeTimestamp(1719600000000)).toBe(1719600000000);
  });

  it("parses ISO strings", () => {
    const iso = new Date(1719600000000).toISOString();
    expect(normalizeTimestamp(iso)).toBe(1719600000000);
  });

  it("parses numeric strings", () => {
    expect(normalizeTimestamp("1719600000000")).toBe(1719600000000);
  });

  it("returns 0 for garbage rather than NaN", () => {
    expect(normalizeTimestamp("not-a-date")).toBe(0);
    expect(normalizeTimestamp(undefined)).toBe(0);
  });
});

describe("normalizeAssignee", () => {
  it("returns a clean assignee", () => {
    expect(normalizeAssignee({ id: "u1", name: "Asha" })).toEqual({ id: "u1", name: "Asha" });
  });

  it("returns null for null or malformed input", () => {
    expect(normalizeAssignee(null)).toBeNull();
    expect(normalizeAssignee({ id: "u1" })).toBeNull();
    expect(normalizeAssignee("nope")).toBeNull();
  });
});

describe("normalizeTask", () => {
  it("normalizes a full messy record", () => {
    const task = normalizeTask({
      id: "t1",
      title: "Task 1",
      type: "video",
      status: "InProgress",
      assignee: null,
      annotationCount: "9",
      updatedAt: "2024-06-28T20:00:00.000Z",
      meta: { priority: "high" },
    });
    expect(task).not.toBeNull();
    expect(task).toMatchObject({
      id: "t1",
      type: "unknown",
      rawType: "video",
      status: "in_progress",
      rawStatus: "InProgress",
      assignee: null,
      annotationCount: 9,
      partial: false,
    });
    expect(task?.updatedAt).toBeGreaterThan(0);
  });

  it("drops records without a usable id", () => {
    expect(normalizeTask({ title: "no id" })).toBeNull();
    expect(normalizeTask({ id: "" })).toBeNull();
    expect(normalizeTask("garbage")).toBeNull();
  });

  it("defaults a missing title to the id so rows are never blank", () => {
    expect(normalizeTask({ id: "t7" })?.title).toBe("t7");
  });
});

describe("normalizeTasksResponse", () => {
  it("normalizes items and counts dropped records", () => {
    const result = normalizeTasksResponse({
      page: 1,
      pageSize: 2,
      total: 3,
      items: [{ id: "t1", type: "image" }, { id: "t2", type: "text" }, { title: "no id" }],
    });
    expect(result.tasks).toHaveLength(2);
    expect(result.dropped).toBe(1);
    expect(result.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
  });

  it("tolerates a completely malformed envelope", () => {
    const result = normalizeTasksResponse(null);
    expect(result.tasks).toEqual([]);
    expect(result.meta.page).toBe(1);
  });
});
