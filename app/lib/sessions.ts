import { getDB } from "@/app/lib/db";
import type { Task } from "@/app/lib/tasks";
import type { TimerMode } from "@/app/lib/timer";

/** A single completed run, written once by the completion handler (F005 / F010). */
export interface SessionRecord {
  id: string;
  mode: TimerMode;
  durationMs: number;
  /** Epoch ms at which the session reached zero. */
  completedAt: number;
  /** Task selected when the focus session completed (F009). */
  taskId?: string;
  /**
   * Title snapshot taken at completion time: editing or deleting the task later
   * never rewrites a session that already happened (F009).
   */
  taskTitle?: string;
}

export type SessionInput = Omit<SessionRecord, "id">;

export interface SessionCompletionContext {
  mode: TimerMode;
  durationMs: number;
  completedAt: number;
  /** The active task at completion time, if any. */
  activeTask: Pick<Task, "id" | "title"> | null;
}

/**
 * Builds the immutable payload stored for a completed run.
 *
 * Only focus sessions take task context; break sessions are never attributed
 * to a task. The title is copied, not referenced, so later task edits cannot
 * change history (F009).
 */
export function buildSessionInput({
  mode,
  durationMs,
  completedAt,
  activeTask,
}: SessionCompletionContext): SessionInput {
  const input: SessionInput = { mode, durationMs, completedAt };

  if (mode === "focus" && activeTask) {
    input.taskId = activeTask.id;
    input.taskTitle = activeTask.title;
  }

  return input;
}

/**
 * Stores one completed session.
 *
 * Never throws: when IndexedDB is unavailable (private mode, quota, disabled
 * storage) the session is dropped and the app keeps working — recording is
 * best effort, the completion feedback itself must not fail (F028 degrades
 * silently).
 */
export async function recordSession(input: SessionInput): Promise<SessionRecord | null> {
  try {
    const db = await getDB();
    const session: SessionRecord = { id: crypto.randomUUID(), ...input };
    await db.add("sessions", session);
    return session;
  } catch {
    return null;
  }
}

/** All recorded sessions, oldest first. Returns an empty list when storage is unavailable. */
export async function getSessions(): Promise<SessionRecord[]> {
  try {
    const db = await getDB();
    const sessions = await db.getAll("sessions");
    return sessions.sort((a, b) => a.completedAt - b.completedAt);
  } catch {
    return [];
  }
}
