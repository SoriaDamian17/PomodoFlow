import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/app/lib/db";
import {
  createTask,
  deleteTask,
  getTasks,
  parseStoredTask,
  updateTask,
  type Task,
} from "@/app/lib/tasks";

/**
 * F014 task-update coverage: the persistence layer is exercised against an
 * in-memory stand-in for idb so validation, patching and failure handling are
 * deterministic without a browser.
 */

vi.mock("@/app/lib/db", () => ({ getDB: vi.fn() }));

const mockGetDB = vi.mocked(getDB);

interface MemoryDB {
  tasks: Map<string, Task>;
  add: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  getAll: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

function makeMemoryDB(): MemoryDB {
  const tasks = new Map<string, Task>();

  return {
    tasks,
    add: vi.fn(async (_store: string, task: Task) => {
      if (tasks.has(task.id)) throw new Error("ConstraintError");
      tasks.set(task.id, task);
      return task;
    }),
    get: vi.fn(async (_store: string, id: string) => tasks.get(id)),
    getAll: vi.fn(async () => [...tasks.values()]),
    put: vi.fn(async (_store: string, task: Task) => {
      tasks.set(task.id, task);
      return task;
    }),
    delete: vi.fn(async (_store: string, id: string) => {
      tasks.delete(id);
    }),
  };
}

let memory: MemoryDB;

beforeEach(() => {
  memory = makeMemoryDB();
  mockGetDB.mockResolvedValue(memory as never);
});

describe("updateTask (F007/F014)", () => {
  it("applies a partial edit and bumps updatedAt", async () => {
    const created = await createTask({
      title: "Original",
      description: "",
      priority: "medium",
      status: "todo",
    });
    expect(created).not.toBeNull();

    const updated = await updateTask(created!.id, {
      title: "Edited",
      priority: "high",
      status: "in-progress",
    });

    expect(updated).toMatchObject({
      id: created!.id,
      title: "Edited",
      priority: "high",
      status: "in-progress",
      // Untouched fields survive the patch.
      description: "",
      createdAt: created!.createdAt,
    });
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(created!.updatedAt);
    expect(memory.tasks.get(created!.id)).toEqual(updated);
  });

  it("rejects an invalid patch and leaves the stored task unchanged", async () => {
    const created = await createTask({
      title: "Keep me",
      description: "",
      priority: "medium",
      status: "todo",
    });
    const before = memory.tasks.get(created!.id);

    const result = await updateTask(created!.id, { title: "   " });

    expect(result).toBeNull();
    expect(memory.tasks.get(created!.id)).toEqual(before);
  });

  it("returns null for a task that does not exist", async () => {
    expect(await updateTask("missing", { title: "Anything" })).toBeNull();
    expect(memory.put).not.toHaveBeenCalled();
  });

  it("returns null when a stored row is malformed", async () => {
    memory.tasks.set("bad", { id: "bad" } as never);

    expect(await updateTask("bad", { title: "Valid" })).toBeNull();
    expect(memory.put).not.toHaveBeenCalled();
  });

  it("returns null when storage fails", async () => {
    memory.put.mockRejectedValueOnce(new Error("QuotaExceededError"));

    const created = await createTask({
      title: "Valid",
      description: "",
      priority: "medium",
      status: "todo",
    });

    expect(await updateTask(created!.id, { title: "Still valid" })).toBeNull();
  });
});

describe("createTask (F006/F014)", () => {
  it("returns null for an invalid draft without touching storage", async () => {
    const result = await createTask({
      title: "   ",
      description: "",
      priority: "medium",
      status: "todo",
    });

    expect(result).toBeNull();
    expect(memory.add).not.toHaveBeenCalled();
  });

  it("returns null when the write fails", async () => {
    memory.add.mockRejectedValueOnce(new Error("QuotaExceededError"));

    expect(
      await createTask({
        title: "Valid",
        description: "",
        priority: "medium",
        status: "todo",
      }),
    ).toBeNull();
  });
});

describe("getTasks (F012 recovery)", () => {
  it("drops malformed rows and returns the rest newest first", async () => {
    memory.tasks.set("a", {
      id: "a",
      title: "First",
      description: "",
      priority: "low",
      status: "todo",
      createdAt: 100,
      updatedAt: 100,
    });
    memory.tasks.set("b", { id: "b" } as never); // malformed row
    memory.tasks.set("c", {
      id: "c",
      title: "Newer",
      description: "",
      priority: "high",
      status: "done",
      createdAt: 200,
      updatedAt: 200,
    });

    const tasks = await getTasks();

    expect(tasks.map((t) => t.id)).toEqual(["c", "a"]);
  });

  it("returns an empty list when storage is unavailable", async () => {
    mockGetDB.mockRejectedValueOnce(new Error("SecurityError"));

    expect(await getTasks()).toEqual([]);
  });

  it("returns an empty list for an empty store", async () => {
    expect(await getTasks()).toEqual([]);
  });
});

describe("deleteTask (F007)", () => {
  it("deletes an existing task", async () => {
    const created = await createTask({
      title: "Delete me",
      description: "",
      priority: "medium",
      status: "todo",
    });

    expect(await deleteTask(created!.id)).toBe(true);
    expect(memory.tasks.has(created!.id)).toBe(false);
  });

  it("returns false when the write fails", async () => {
    memory.delete.mockRejectedValueOnce(new Error("SecurityError"));

    expect(await deleteTask("any")).toBe(false);
  });
});

describe("parseStoredTask still guards the read path", () => {
  it("rejects a row with an unknown status", () => {
    expect(
      parseStoredTask({
        id: "x",
        title: "Ok",
        priority: "low",
        status: "archived",
      }),
    ).toBeNull();
  });
});
