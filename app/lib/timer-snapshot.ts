import type { CountdownSnapshot } from "@/app/lib/countdown-core";
import { TIMER_MODES, type TimerMode } from "@/app/lib/timer";

/** A restorable countdown plus the mode it was started in (F027). */
export interface TimerSnapshot extends CountdownSnapshot {
  mode: TimerMode;
  updatedAt: number;
}

export const TIMER_SNAPSHOT_KEY = "pomodoroflow:timer";

function isTimerMode(value: unknown): value is TimerMode {
  return typeof value === "string" && (TIMER_MODES as readonly string[]).includes(value);
}

function parseSnapshot(raw: string | null): TimerSnapshot | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    if (!isTimerMode(candidate.mode)) return null;
    if (candidate.status !== "running" && candidate.status !== "paused") return null;

    const { mode, status } = candidate;
    const durationMs = candidate.durationMs;
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
      return null;
    }

    let endsAt: number | null = null;
    let remainingMs = 0;

    if (status === "running") {
      if (typeof candidate.endsAt !== "number" || !Number.isFinite(candidate.endsAt)) return null;
      endsAt = candidate.endsAt;
      remainingMs =
        typeof candidate.remainingMs === "number" && Number.isFinite(candidate.remainingMs)
          ? Math.max(0, candidate.remainingMs)
          : 0;
    } else {
      if (typeof candidate.remainingMs !== "number" || !Number.isFinite(candidate.remainingMs)) {
        return null;
      }
      remainingMs = Math.max(0, candidate.remainingMs);
    }

    return {
      mode,
      status,
      durationMs,
      endsAt,
      remainingMs,
      updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Reads the stored in-progress countdown, or `null` when storage is missing,
 * malformed or the session already ran out while the tab was closed.
 */
export function readTimerSnapshot(): TimerSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    return parseSnapshot(window.localStorage.getItem(TIMER_SNAPSHOT_KEY));
  } catch {
    return null;
  }
}

/**
 * Writes the snapshot for a running or paused countdown and clears it for any
 * other status, so a reload never restores an idle or already completed timer.
 * Storage failures (private mode, quota) are ignored: the timer simply starts
 * fresh after the next reload.
 */
export function writeTimerSnapshot(snapshot: TimerSnapshot): void {
  if (typeof window === "undefined") return;

  try {
    if (snapshot.status !== "running" && snapshot.status !== "paused") {
      window.localStorage.removeItem(TIMER_SNAPSHOT_KEY);
      return;
    }
    window.localStorage.setItem(TIMER_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Best effort only; see doc comment.
  }
}

export function clearTimerSnapshot(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(TIMER_SNAPSHOT_KEY);
  } catch {
    // Best effort only.
  }
}

/**
 * Whether a snapshot describes a run that can still be picked up after a
 * reload: a paused countdown with time left, or a running one whose target
 * time has not passed yet. A run that expired while the tab was closed is
 * abandoned, never restored and never reported as a completion (F005).
 */
export function isRestorableTimerSnapshot(
  snapshot: TimerSnapshot,
  now: number = Date.now(),
): boolean {
  if (snapshot.status === "running") {
    return typeof snapshot.endsAt === "number" && Number.isFinite(snapshot.endsAt) && snapshot.endsAt > now;
  }
  return (
    typeof snapshot.remainingMs === "number" &&
    Number.isFinite(snapshot.remainingMs) &&
    snapshot.remainingMs > 0
  );
}
