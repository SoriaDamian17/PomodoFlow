import { getDB } from "@/app/lib/db";
import type { TimerMode } from "@/app/lib/timer";

/** A single completed run, written once by the completion handler (F005 / F010). */
export interface SessionRecord {
  id: string;
  mode: TimerMode;
  durationMs: number;
  /** Epoch ms at which the session reached zero. */
  completedAt: number;
}

export type SessionInput = Omit<SessionRecord, "id">;

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
