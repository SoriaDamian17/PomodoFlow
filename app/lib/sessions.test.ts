import { describe, expect, it } from "vitest";
import { buildSessionInput } from "@/app/lib/sessions";

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
