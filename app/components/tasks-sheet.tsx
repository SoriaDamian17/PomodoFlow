"use client";

import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { cn } from "@/app/lib/cn";
import {
  ALL_TASK_FILTERS,
  DEFAULT_TASK_DRAFT,
  TASK_PRIORITIES,
  TASK_PRIORITY_META,
  TASK_STATUSES,
  TASK_STATUS_META,
  filterTasks,
  isFilteringTasks,
  validateTaskDraft,
  type Task,
  type TaskDraft,
  type TaskErrors,
  type TaskFilters,
  type TaskPriority,
  type TaskStatus,
} from "@/app/lib/tasks";
import { Sheet } from "@/app/components/sheet";

type CreateHandler = (draft: TaskDraft) => Promise<Task | null>;
type UpdateHandler = (id: string, patch: Partial<TaskDraft>) => Promise<Task | null>;
type DeleteHandler = (id: string) => Promise<boolean>;

export interface TasksSheetProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  /** False until the IndexedDB read settles. */
  ready: boolean;
  storageAvailable: boolean;
  activeTaskId: string | null;
  onSelectActiveTask: (id: string | null) => void;
  onCreate: CreateHandler;
  onUpdate: UpdateHandler;
  onDelete: DeleteHandler;
  /** Optional context rendered in the sheet header (F022 timer indicator). */
  headerExtra?: ReactNode;
}

/**
 * Tasks sheet: create, edit, delete, change status and filter tasks (F006–F008),
 * plus the active-task selector used by focus sessions (F009).
 *
 * All mutations go through the dashboard-owned store so the timer stage and the
 * sheet always read the same list.
 */
export function TasksSheet({
  open,
  onClose,
  tasks,
  ready,
  storageAvailable,
  activeTaskId,
  onSelectActiveTask,
  onCreate,
  onUpdate,
  onDelete,
  headerExtra,
}: TasksSheetProps) {
  const [filters, setFilters] = useState<TaskFilters>(ALL_TASK_FILTERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const visibleTasks = filterTasks(tasks, filters);
  const filtering = isFilteringTasks(filters);

  async function handleCreate(draft: TaskDraft) {
    const task = await onCreate(draft);
    if (task) setNotice(`Added “${task.title}”.`);
    return task !== null;
  }

  async function handleEdit(task: Task, draft: TaskDraft) {
    const updated = await onUpdate(task.id, draft);
    if (!updated) return false;

    setEditingId(null);
    setNotice(`Saved “${updated.title}”.`);
    return true;
  }

  async function handleStatusChange(task: Task, status: TaskStatus) {
    const updated = await onUpdate(task.id, { status });
    if (updated) {
      setNotice(
        `“${updated.title}” is now ${TASK_STATUS_META[status].label.toLowerCase()}.`,
      );
    } else {
      setNotice("Could not update the task status.");
    }
  }

  async function handleDelete(task: Task) {
    const deleted = await onDelete(task.id);
    setPendingDeleteId(null);

    if (!deleted) {
      setNotice("Could not delete the task. Try again.");
      return;
    }

    if (editingId === task.id) setEditingId(null);
    setNotice(`Deleted “${task.title}”.`);
  }

  function handleToggleActive(task: Task) {
    onSelectActiveTask(activeTaskId === task.id ? null : task.id);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Tasks"
      description="Plan what this focus session is for."
      headerExtra={headerExtra}
    >
      <div className="flex flex-col gap-5">
        <p role="status" aria-live="polite" className="sr-only">
          {notice}
        </p>

        {!storageAvailable ? (
          <p
            role="alert"
            className="rounded-2xl border border-accent-text/40 bg-accent/10 px-3.5 py-3 text-xs leading-relaxed text-foreground"
          >
            Tasks cannot be saved right now: browser storage is unavailable.
            New tasks will not be kept and existing tasks cannot be loaded.
          </p>
        ) : null}

        <section aria-label="New task" className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">Add a task</h3>
          <TaskForm
            initial={DEFAULT_TASK_DRAFT}
            submitLabel="Add task"
            resetOnSuccess
            onSubmit={handleCreate}
          />
        </section>

        <section
          aria-label="Task filters"
          className="flex flex-col gap-2.5 rounded-2xl border border-glass-border bg-foreground/5 p-3"
        >
          <FilterGroup
            legend="Status"
            value={filters.status}
            options={[
              { value: "all", label: "All" },
              ...TASK_STATUSES.map((status) => ({
                value: status,
                label: TASK_STATUS_META[status].label,
              })),
            ]}
            onChange={(status) => setFilters((current) => ({ ...current, status }))}
          />
          <FilterGroup
            legend="Priority"
            value={filters.priority}
            options={[
              { value: "all", label: "All" },
              ...TASK_PRIORITIES.map((priority) => ({
                value: priority,
                label: TASK_PRIORITY_META[priority].label,
              })),
            ]}
            onChange={(priority) =>
              setFilters((current) => ({ ...current, priority }))
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <p className="text-[11px] text-muted">
              {filtering
                ? `Showing ${visibleTasks.length} of ${tasks.length} tasks`
                : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
            </p>
            {filtering ? (
              <button
                type="button"
                onClick={() => setFilters(ALL_TASK_FILTERS)}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium text-accent-text underline-offset-4 hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </section>

        <section aria-label="Task list" className="flex flex-col gap-2.5">
          {visibleTasks.length === 0 ? (
            <EmptyState
              ready={ready}
              filtering={filtering}
              onClearFilters={() => setFilters(ALL_TASK_FILTERS)}
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visibleTasks.map((task) => {
                const isEditing = editingId === task.id;
                const isConfirmingDelete = pendingDeleteId === task.id;

                return (
                  <li
                    key={task.id}
                    className={cn(
                      "rounded-2xl border p-3.5 transition-colors",
                      activeTaskId === task.id
                        ? "border-accent-text/50 bg-accent/10"
                        : "border-glass-border bg-foreground/5",
                    )}
                  >
                    {isEditing ? (
                      <TaskForm
                        initial={{
                          title: task.title,
                          description: task.description,
                          priority: task.priority,
                          status: task.status,
                        }}
                        submitLabel="Save changes"
                        onCancel={() => setEditingId(null)}
                        onSubmit={(draft) => handleEdit(task, draft)}
                      />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4
                              className={cn(
                                "text-sm font-semibold break-words",
                                task.status === "done"
                                  ? "text-muted line-through"
                                  : "text-foreground",
                              )}
                            >
                              {task.title}
                            </h4>
                            {task.description ? (
                              <p className="mt-1 text-xs leading-relaxed break-words whitespace-pre-line text-muted">
                                {task.description}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                  PRIORITY_BADGE[task.priority],
                                )}
                              >
                                {TASK_PRIORITY_META[task.priority].label} priority
                              </span>
                              <span className="rounded-full border border-glass-border bg-foreground/5 px-2 py-0.5 text-[11px] text-muted">
                                {TASK_STATUS_META[task.status].label}
                              </span>
                              {activeTaskId === task.id ? (
                                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-contrast">
                                  Focus task
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {isConfirmingDelete ? (
                          <div
                            role="group"
                            aria-label={`Confirm deleting ${task.title}`}
                            className="mt-3 rounded-xl border border-accent-text/40 bg-accent/10 p-3"
                          >
                            <p className="text-xs leading-relaxed text-foreground">
                              Delete “{task.title}”? This cannot be undone.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleDelete(task)}
                                className="btn-primary h-10 px-4 text-xs"
                              >
                                Delete task
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(null)}
                                className="h-10 rounded-full px-4 text-xs font-medium text-muted transition-colors hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <label
                                htmlFor={`task-status-${task.id}`}
                                className="sr-only"
                              >
                                Status for {task.title}
                              </label>
                              <select
                                id={`task-status-${task.id}`}
                                value={task.status}
                                onChange={(event) =>
                                  void handleStatusChange(
                                    task,
                                    event.target.value as TaskStatus,
                                  )
                                }
                                className="h-10 rounded-full border border-glass-border bg-foreground/5 px-3 text-xs font-medium text-foreground"
                              >
                                {TASK_STATUSES.map((status) => (
                                  <option
                                    key={status}
                                    value={status}
                                    className="bg-background text-foreground"
                                  >
                                    {TASK_STATUS_META[status].label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              aria-pressed={activeTaskId === task.id}
                              aria-label={
                                activeTaskId === task.id
                                  ? `Clear active task ${task.title}`
                                  : `Use ${task.title} for the next focus session`
                              }
                              onClick={() => handleToggleActive(task)}
                              className={cn(
                                "h-10 rounded-full border px-3 text-xs font-medium transition-colors",
                                activeTaskId === task.id
                                  ? "border-accent-text/60 bg-accent/15 text-foreground"
                                  : "border-glass-border bg-foreground/5 text-muted hover:text-foreground",
                              )}
                            >
                              {activeTaskId === task.id ? "Active task" : "Focus on this"}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPendingDeleteId(null);
                                setEditingId(task.id);
                              }}
                              className="h-10 rounded-full px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(task.id)}
                              className="h-10 rounded-full px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  high: "border-accent-text/60 bg-accent/15 text-foreground",
  medium: "border-glass-border bg-foreground/10 text-foreground",
  low: "border-glass-border bg-foreground/5 text-muted",
};

/* -------------------------------------------------------------------------- */
/* Form                                                                        */
/* -------------------------------------------------------------------------- */

interface TaskFormProps {
  initial: TaskDraft;
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => Promise<boolean>;
  onCancel?: () => void;
  /** Clear every field after a successful submit (the create form). */
  resetOnSuccess?: boolean;
}

function TaskForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSuccess = false,
}: TaskFormProps) {
  const fieldId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<TaskDraft>(initial);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const titleId = `${fieldId}-title`;
  const titleErrorId = `${titleId}-error`;
  const descriptionId = `${fieldId}-description`;
  const descriptionErrorId = `${descriptionId}-error`;
  const priorityId = `${fieldId}-priority`;
  const statusId = `${fieldId}-status`;

  function setField<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    // Inline validation runs before anything touches IndexedDB (F006).
    const result = validateTaskDraft(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const saved = await onSubmit(result.draft);
      if (!saved) {
        setFormError(
          "Could not save the task. Check that browser storage is available and try again.",
        );
        return;
      }

      setValues(resetOnSuccess ? initial : result.draft);
      if (resetOnSuccess) titleRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
      <div>
        <label
          htmlFor={titleId}
          className="text-xs font-medium text-muted"
        >
          Title
        </label>
        <input
          ref={titleRef}
          id={titleId}
          name="title"
          type="text"
          autoComplete="off"
          value={values.title}
          onChange={(event) => setField("title", event.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? titleErrorId : undefined}
          className={cn(
            "mt-1.5 h-11 w-full rounded-2xl border bg-foreground/5 px-3.5 text-sm text-foreground transition-colors outline-none",
            errors.title
              ? "border-accent-text/70"
              : "border-glass-border focus-visible:border-accent-strong",
          )}
        />
        {errors.title ? (
          <p id={titleErrorId} role="alert" className="mt-1.5 text-xs text-accent-text">
            {errors.title}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor={descriptionId}
          className="text-xs font-medium text-muted"
        >
          Description <span className="font-normal">(optional)</span>
        </label>
        <textarea
          id={descriptionId}
          name="description"
          rows={3}
          value={values.description}
          onChange={(event) => setField("description", event.target.value)}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? descriptionErrorId : undefined}
          className={cn(
            "mt-1.5 w-full resize-y rounded-2xl border bg-foreground/5 px-3.5 py-2.5 text-sm text-foreground transition-colors outline-none",
            errors.description
              ? "border-accent-text/70"
              : "border-glass-border focus-visible:border-accent-strong",
          )}
        />
        {errors.description ? (
          <p
            id={descriptionErrorId}
            role="alert"
            className="mt-1.5 text-xs text-accent-text"
          >
            {errors.description}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={priorityId} className="text-xs font-medium text-muted">
            Priority
          </label>
          <select
            id={priorityId}
            name="priority"
            value={values.priority}
            onChange={(event) =>
              setField("priority", event.target.value as TaskPriority)
            }
            className="mt-1.5 h-11 w-full rounded-2xl border border-glass-border bg-foreground/5 px-3 text-sm text-foreground"
          >
            {TASK_PRIORITIES.map((priority) => (
              <option
                key={priority}
                value={priority}
                className="bg-background text-foreground"
              >
                {TASK_PRIORITY_META[priority].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={statusId} className="text-xs font-medium text-muted">
            Status
          </label>
          <select
            id={statusId}
            name="status"
            value={values.status}
            onChange={(event) =>
              setField("status", event.target.value as TaskStatus)
            }
            className="mt-1.5 h-11 w-full rounded-2xl border border-glass-border bg-foreground/5 px-3 text-sm text-foreground"
          >
            {TASK_STATUSES.map((status) => (
              <option
                key={status}
                value={status}
                className="bg-background text-foreground"
              >
                {TASK_STATUS_META[status].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {formError ? (
        <p
          role="alert"
          className="rounded-2xl border border-accent-text/40 bg-accent/10 px-3.5 py-2.5 text-xs leading-relaxed text-foreground"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-0.5">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary h-11 px-5 text-sm disabled:opacity-60"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Filters and empty states                                                    */
/* -------------------------------------------------------------------------- */

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterGroupProps<T extends string> {
  legend: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
}

function FilterGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
}: FilterGroupProps<T>) {
  const legendId = useId();

  return (
    <div
      role="group"
      aria-labelledby={legendId}
      className="flex flex-wrap items-center gap-1.5"
    >
      <span
        id={legendId}
        className="mr-1 min-w-14 text-[11px] font-medium tracking-wide text-muted uppercase"
      >
        {legend}
      </span>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-10 rounded-full border px-3 text-xs font-medium transition-colors",
              isActive
                ? "border-accent-text/60 bg-accent/15 text-foreground"
                : "border-glass-border bg-foreground/5 text-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface EmptyStateProps {
  ready: boolean;
  filtering: boolean;
  onClearFilters: () => void;
}

function EmptyState({ ready, filtering, onClearFilters }: EmptyStateProps) {
  if (filtering) {
    return (
      <div className="rounded-2xl border border-dashed border-glass-border px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">
          No tasks match these filters
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Your tasks are still here. Clear the status and priority filters to
          see them again.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-3 h-10 rounded-full border border-glass-border bg-foreground/5 px-4 text-xs font-medium text-foreground hover:bg-foreground/10"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-glass-border px-4 py-8 text-center">
      <p className="text-sm font-medium text-foreground">
        {ready ? "No tasks yet" : "Loading tasks…"}
      </p>
      {ready ? (
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Add your first task above to give this session a target.
        </p>
      ) : null}
    </div>
  );
}
