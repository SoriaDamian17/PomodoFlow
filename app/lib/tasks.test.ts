import { describe, expect, it } from "vitest";
import {
  ALL_TASK_FILTERS,
  TASK_LIMITS,
  filterTasks,
  isFilteringTasks,
  parseStoredTask,
  sortTasks,
  validateTaskDraft,
  type Task,
} from "@/app/lib/tasks";

const T0 = 1_700_000_000_000;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Write the draft",
    description: overrides.description ?? "",
    priority: overrides.priority ?? "medium",
    status: overrides.status ?? "todo",
    createdAt: overrides.createdAt ?? T0,
    updatedAt: overrides.updatedAt ?? T0,
  };
}

describe("validateTaskDraft (F006)", () => {
  it("accepts a title with no optional fields", () => {
    const result = validateTaskDraft({
      title: "Plan the week",
      description: "",
      priority: "medium",
      status: "todo",
    });

    expect(result).toEqual({
      ok: true,
      draft: {
        title: "Plan the week",
        description: "",
        priority: "medium",
        status: "todo",
      },
    });
  });

  it("trims the title and description before storing them", () => {
    const result = validateTaskDraft({
      title: "   Review PR   ",
      description: "\n  Check the diff  \n",
      priority: "high",
      status: "in-progress",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.title).toBe("Review PR");
    expect(result.draft.description).toBe("Check the diff");
  });

  it("rejects an empty or whitespace-only title with an inline message", () => {
    for (const title of ["", "   ", "\n\t "]) {
      const result = validateTaskDraft({
        title,
        description: "",
        priority: "medium",
        status: "todo",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.title).toBeTruthy();
    }
  });

  it("rejects over-long titles and descriptions", () => {
    const longTitle = validateTaskDraft({
      title: "a".repeat(TASK_LIMITS.title + 1),
      description: "",
      priority: "medium",
      status: "todo",
    });
    expect(longTitle.ok).toBe(false);
    if (!longTitle.ok) expect(longTitle.errors.title).toBeTruthy();

    const longDescription = validateTaskDraft({
      title: "Valid",
      description: "a".repeat(TASK_LIMITS.description + 1),
      priority: "medium",
      status: "todo",
    });
    expect(longDescription.ok).toBe(false);
    if (!longDescription.ok) {
      expect(longDescription.errors.description).toBeTruthy();
    }
  });

  it("rejects unknown priorities and statuses", () => {
    const result = validateTaskDraft({
      title: "Valid",
      description: "",
      priority: "urgent",
      status: "archived",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.priority).toBeTruthy();
    expect(result.errors.status).toBeTruthy();
  });
});

describe("filterTasks (F008)", () => {
  const tasks = [
    makeTask({ id: "a", status: "todo", priority: "high", createdAt: T0 + 1 }),
    makeTask({
      id: "b",
      status: "in-progress",
      priority: "medium",
      createdAt: T0 + 2,
    }),
    makeTask({ id: "c", status: "done", priority: "high", createdAt: T0 + 3 }),
  ];

  it("returns every task when no filter is active", () => {
    expect(filterTasks(tasks, ALL_TASK_FILTERS)).toHaveLength(3);
    expect(isFilteringTasks(ALL_TASK_FILTERS)).toBe(false);
  });

  it("filters by status", () => {
    expect(
      filterTasks(tasks, { status: "done", priority: "all" }).map((t) => t.id),
    ).toEqual(["c"]);
    expect(isFilteringTasks({ status: "done", priority: "all" })).toBe(true);
  });

  it("filters by priority", () => {
    expect(
      filterTasks(tasks, { status: "all", priority: "high" }).map((t) => t.id),
    ).toEqual(["a", "c"]);
  });

  it("combines status and priority filters", () => {
    expect(
      filterTasks(tasks, { status: "todo", priority: "high" }).map((t) => t.id),
    ).toEqual(["a"]);
  });

  it("returns an empty list for a combination with no matches", () => {
    expect(filterTasks(tasks, { status: "done", priority: "low" })).toEqual([]);
  });
});

describe("sortTasks", () => {
  it("keeps the newest task first and stays stable across edits", () => {
    const older = makeTask({ id: "older", createdAt: T0, updatedAt: T0 });
    const newer = makeTask({ id: "newer", createdAt: T0 + 5, updatedAt: T0 + 5 });

    expect(sortTasks([older, newer]).map((t) => t.id)).toEqual([
      "newer",
      "older",
    ]);

    // Editing the older task bumps updatedAt but must not reorder the list.
    const edited = { ...older, updatedAt: T0 + 10 };
    expect(sortTasks([older, newer, edited]).map((t) => t.id)).toEqual([
      "newer",
      "older",
      "older",
    ]);
  });
});

describe("parseStoredTask (F012 recovery)", () => {
  it("round-trips a valid stored row", () => {
    const task = makeTask({ description: "Details" });
    expect(parseStoredTask(task)).toEqual(task);
  });

  it("drops malformed rows instead of crashing the sheet", () => {
    expect(parseStoredTask(null)).toBeNull();
    expect(parseStoredTask("nope")).toBeNull();
    expect(parseStoredTask({})).toBeNull();
    expect(parseStoredTask({ id: "x", title: "   " })).toBeNull();
    expect(
      parseStoredTask({ id: "x", title: "Ok", priority: "urgent", status: "todo" }),
    ).toBeNull();
  });

  it("fills missing optional values with recoverable defaults", () => {
    const parsed = parseStoredTask({
      id: "x",
      title: "Recovered task",
      priority: "low",
      status: "todo",
    });

    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      id: "x",
      title: "Recovered task",
      description: "",
      priority: "low",
      status: "todo",
      createdAt: 0,
      updatedAt: 0,
    });
  });
});
