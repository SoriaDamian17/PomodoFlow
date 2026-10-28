import { getDB } from "@/app/lib/db";
import { requestPersistentStorage } from "@/app/lib/storage";

/**
 * Task model for the Tasks sheet (F006–F008).
 *
 * A task is plain data: the sheet owns the draft/validation UX and this module
 * owns persistence plus the pure helpers (validation, filtering, sorting) so
 * they can be unit-tested without a browser.
 */

export const TASK_STATUSES = ["todo", "in-progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
}

/** The user-editable part of a task; ids and timestamps are generated here. */
export interface TaskDraft {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
}

export const DEFAULT_TASK_DRAFT: TaskDraft = {
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
};

export const TASK_LIMITS = {
  title: 120,
  description: 500,
} as const;

export const TASK_STATUS_META: Record<TaskStatus, { label: string }> = {
  todo: { label: "To do" },
  "in-progress": { label: "In progress" },
  done: { label: "Done" },
};

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string }> = {
  low: { label: "Low" },
  medium: { label: "Medium" },
  high: { label: "High" },
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority);
}

export type TaskField = "title" | "description" | "priority" | "status";
export type TaskErrors = Partial<Record<TaskField, string>>;

export type TaskValidation =
  | { ok: true; draft: TaskDraft }
  | { ok: false; errors: TaskErrors };

interface TaskDraftInput {
  title: string;
  description: string;
  priority: unknown;
  status: unknown;
}

/**
 * Validates a raw draft coming from the form.
 *
 * A whitespace-only title is rejected with an inline message (F006), and the
 * trimmed values are what gets stored — never the untrimmed input.
 */
export function validateTaskDraft(input: TaskDraftInput): TaskValidation {
  const errors: TaskErrors = {};
  const title = input.title.trim();
  const description = input.description.trim();

  if (title.length === 0) {
    errors.title = "Add a title so you can recognise this task.";
  } else if (title.length > TASK_LIMITS.title) {
    errors.title = `Keep the title under ${TASK_LIMITS.title} characters.`;
  }

  if (description.length > TASK_LIMITS.description) {
    errors.description = `Keep the description under ${TASK_LIMITS.description} characters.`;
  }

  if (!isTaskPriority(input.priority)) {
    errors.priority = "Choose a priority: low, medium or high.";
  }

  if (!isTaskStatus(input.status)) {
    errors.status = "Choose a status: to do, in progress or done.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    draft: {
      title,
      description,
      priority: input.priority as TaskPriority,
      status: input.status as TaskStatus,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Filtering (F008)                                                           */
/* -------------------------------------------------------------------------- */

export type TaskStatusFilter = TaskStatus | "all";
export type TaskPriorityFilter = TaskPriority | "all";

export interface TaskFilters {
  status: TaskStatusFilter;
  priority: TaskPriorityFilter;
}

export const ALL_TASK_FILTERS: TaskFilters = { status: "all", priority: "all" };

export function isFilteringTasks(filters: TaskFilters): boolean {
  return filters.status !== "all" || filters.priority !== "all";
}

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter((task) => {
    const matchesStatus =
      filters.status === "all" || task.status === filters.status;
    const matchesPriority =
      filters.priority === "all" || task.priority === filters.priority;
    return matchesStatus && matchesPriority;
  });
}

/**
 * Newest first and stable across edits: sorting by `createdAt` means saving an
 * edit never makes a row jump to the top of the list.
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.createdAt - a.createdAt);
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Defensive parser for stored rows: malformed values are dropped rather than
 * crashing the sheet, mirroring the settings/read recovery strategy (F012).
 */
export function parseStoredTask(value: unknown): Task | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    return null;
  }

  const validation = validateTaskDraft({
    title: typeof candidate.title === "string" ? candidate.title : "",
    description:
      typeof candidate.description === "string" ? candidate.description : "",
    priority: candidate.priority,
    status: candidate.status,
  });

  if (!validation.ok) return null;

  const createdAt =
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt)
      ? candidate.createdAt
      : 0;
  const updatedAt =
    typeof candidate.updatedAt === "number" &&
    Number.isFinite(candidate.updatedAt)
      ? candidate.updatedAt
      : createdAt;

  return {
    id: candidate.id,
    ...validation.draft,
    createdAt,
    updatedAt,
  };
}

/** All stored tasks, newest first. Returns an empty list when storage fails. */
export async function getTasks(): Promise<Task[]> {
  try {
    const db = await getDB();
    const records: unknown[] = await db.getAll("tasks");
    const parsed = records
      .map(parseStoredTask)
      .filter((task): task is Task => task !== null);
    return sortTasks(parsed);
  } catch {
    return [];
  }
}

/** True when IndexedDB can be opened; used to surface a visible fallback. */
export async function isTaskStorageAvailable(): Promise<boolean> {
  try {
    await getDB();
    return true;
  } catch {
    return false;
  }
}

/** Creates a task after validating it. Returns null when invalid or unsaved. */
export async function createTask(input: TaskDraftInput): Promise<Task | null> {
  const validation = validateTaskDraft(input);
  if (!validation.ok) return null;

  const now = Date.now();
  const task: Task = {
    id: crypto.randomUUID(),
    ...validation.draft,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDB();
    await db.add("tasks", task);
    // A5: the first real task is a good moment to ask the browser to keep this
    // origin out of eviction. Fire-and-forget: a denial must not fail the write.
    void requestPersistentStorage();
    return task;
  } catch {
    return null;
  }
}

/** Applies a partial edit and bumps `updatedAt`. Returns null when not saved. */
export async function updateTask(
  id: string,
  patch: Partial<TaskDraft>,
): Promise<Task | null> {
  try {
    const db = await getDB();
    const existing = (await db.get("tasks", id)) as unknown;
    const parsed = parseStoredTask(existing);
    if (!parsed) return null;

    const validation = validateTaskDraft({
      title: patch.title ?? parsed.title,
      description: patch.description ?? parsed.description,
      priority: patch.priority ?? parsed.priority,
      status: patch.status ?? parsed.status,
    });

    if (!validation.ok) return null;

    const updated: Task = {
      ...parsed,
      ...validation.draft,
      updatedAt: Date.now(),
    };

    await db.put("tasks", updated);
    return updated;
  } catch {
    return null;
  }
}

/** Deletes a task. Returns false when the write could not be performed. */
export async function deleteTask(id: string): Promise<boolean> {
  try {
    const db = await getDB();
    await db.delete("tasks", id);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Active task for the focus session (F009)                                   */
/* -------------------------------------------------------------------------- */

export const ACTIVE_TASK_STORAGE_KEY = "pomodoroflow:active-task";
export const ACTIVE_TASK_UPDATED_EVENT = "pomodoroflow:active-task-updated";

export function readActiveTaskId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_TASK_STORAGE_KEY);
    return raw && raw.trim().length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/** Persists the selected task so it survives reloads (F009 / F012). */
export function writeActiveTaskId(id: string | null): void {
  if (typeof window === "undefined") return;

  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_TASK_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_TASK_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(ACTIVE_TASK_UPDATED_EVENT));
  } catch {
    // Storage may be unavailable; the selection simply stays in memory.
  }
}
