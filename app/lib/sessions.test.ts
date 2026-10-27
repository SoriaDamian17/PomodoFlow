import { describe, expect, it } from "vitest";
import { buildSessionInput, parseStoredSession } from "@/app/lib/sessions";

const COMPLETED_AT = 1_700_000_000_000;
const FOCUS_MS = 25 * 60_000;

describe("buildSessionInput (F009)", () => {
  it("attributes a completed focus session to the active task", () => {
    const input = buildSessionInput({
      mode: "focus",
      durationMs: FOCUS_MS,
      completedAt: COMPLETED_AT,
      activeTask: { id: "task-1", title: "Write the spec" },
    });

    expect(input).toEqual({
      mode: "focus",
      durationMs: FOCUS_MS,
      completedAt: COMPLETED_AT,
      taskId: "task-1",
      taskTitle: "Write the spec",
    });
  });

  it("records a focus session without task fields when no task is selected", () => {
    const input = buildSessionInput({
      mode: "focus",
      durationMs: FOCUS_MS,
      completedAt: COMPLETED_AT,
      activeTask: null,
    });

    expect(input).toEqual({
      mode: "focus",
      durationMs: FOCUS_MS,
      completedAt: COMPLETED_AT,
    });
    expect("taskId" in input).toBe(false);
    expect("taskTitle" in input).toBe(false);
  });

  it("never attributes break sessions to a task", () => {
    for (const mode of ["short", "long"] as const) {
      const input = buildSessionInput({
        mode,
        durationMs: 5 * 60_000,
        completedAt: COMPLETED_AT,
        activeTask: { id: "task-1", title: "Write the spec" },
      });

      expect(input.mode).toBe(mode);
      expect("taskId" in input).toBe(false);
      expect("taskTitle" in input).toBe(false);
    }
  });

  it("snapshots the title so later task edits cannot rewrite history", () => {
    const task = { id: "task-1", title: "Original title" };
    const input = buildSessionInput({
      mode: "focus",
      durationMs: FOCUS_MS,
      completedAt: COMPLETED_AT,
      activeTask: task,
    });

    task.title = "Renamed later";

    expect(input.taskTitle).toBe("Original title");
  });
});

describe("parseStoredSession (F012 recovery)", () => {
  const valid = {
    id: "session-1",
    mode: "focus",
    durationMs: FOCUS_MS,
    completedAt: COMPLETED_AT,
    taskId: "task-1",
    taskTitle: "Write the spec",
  };

  it("round-trips a valid row including the task snapshot", () => {
    expect(parseStoredSession(valid)).toEqual(valid);
  });

  it("keeps optional task fields absent when they are missing or invalid", () => {
    const parsed = parseStoredSession({
      id: "session-2",
      mode: "short",
      durationMs: 300_000,
      completedAt: COMPLETED_AT,
      taskId: "",
      taskTitle: 42,
    });

    expect(parsed).toEqual({
      id: "session-2",
      mode: "short",
      durationMs: 300_000,
      completedAt: COMPLETED_AT,
    });
  });

  it("drops malformed rows instead of crashing history", () => {
    const malformed = [
      null,
      undefined,
      "nope",
      42,
      {},
      { id: "", mode: "focus", durationMs: FOCUS_MS, completedAt: COMPLETED_AT },
      { id: "x", mode: "nap", durationMs: FOCUS_MS, completedAt: COMPLETED_AT },
      { id: "x", mode: "focus", durationMs: 0, completedAt: COMPLETED_AT },
      { id: "x", mode: "focus", durationMs: -1, completedAt: COMPLETED_AT },
      { id: "x", mode: "focus", durationMs: FOCUS_MS, completedAt: "today" },
      { id: "x", mode: "focus", durationMs: Number.NaN, completedAt: COMPLETED_AT },
    ];

    for (const value of malformed) {
      expect(parseStoredSession(value)).toBeNull();
    }
  });
});
