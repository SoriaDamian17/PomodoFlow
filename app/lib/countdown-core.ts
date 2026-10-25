export type TimerStatus = "idle" | "running" | "paused" | "completed";

export interface CountdownState {
  status: TimerStatus;
  durationMs: number;
  /** Epoch ms at which a running countdown reaches zero. Null unless running. */
  endsAt: number | null;
  /** Frozen remaining time, authoritative whenever the countdown is not running. */
  remainingMs: number;
}

/** Persisted shape of an in-progress countdown (F027 reload restore). */
export interface CountdownSnapshot {
  durationMs: number;
  status: "running" | "paused";
  endsAt: number | null;
  remainingMs: number;
}

export interface TickResult {
  state: CountdownState;
  /** True only on the transition into `completed`, never again afterwards. */
  completed: boolean;
}

/**
 * Pure countdown state machine (F027).
 *
 * Every time-dependent function takes `now` explicitly so tests can advance a
 * mocked clock through start, pause, resume and completion deterministically.
 * The module never touches the DOM, timers or storage.
 */
export function createCountdown(durationMs: number): CountdownState {
  const durationMsSafe = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  return {
    status: "idle",
    durationMs: durationMsSafe,
    endsAt: null,
    remainingMs: durationMsSafe,
  };
}

/** Remaining time for any state; never negative. */
export function remainingOf(state: CountdownState, now: number): number {
  if (state.status === "running" && state.endsAt !== null) {
    return Math.max(0, state.endsAt - now);
  }
  return Math.max(0, state.remainingMs);
}

export function startCountdown(state: CountdownState, now: number): CountdownState {
  if (state.status === "running") return state;

  // A completed run restarts at full length; anything else resumes its own
  // remaining time (idle keeps the configured duration, paused keeps its freeze).
  const baseMs = state.status === "completed" ? state.durationMs : Math.max(0, state.remainingMs);

  return {
    status: "running",
    durationMs: state.durationMs,
    endsAt: now + baseMs,
    remainingMs: baseMs,
  };
}

export function pauseCountdown(state: CountdownState, now: number): CountdownState {
  if (state.status !== "running") return state;

  const remaining = remainingOf(state, now);
  // Hitting zero in the same instant as the pause is a completion, not a pause.
  if (remaining <= 0) {
    return { status: "completed", durationMs: state.durationMs, endsAt: null, remainingMs: 0 };
  }

  return { status: "paused", durationMs: state.durationMs, endsAt: null, remainingMs: remaining };
}

export function resetCountdown(state: CountdownState): CountdownState {
  return createCountdown(state.durationMs);
}

/** One clock step. Reports `completed` exactly once per run. */
export function tickCountdown(state: CountdownState, now: number): TickResult {
  if (state.status !== "running") return { state, completed: false };

  const remaining = remainingOf(state, now);
  if (remaining > 0) {
    return { state: { ...state, remainingMs: remaining }, completed: false };
  }

  return {
    state: { status: "completed", durationMs: state.durationMs, endsAt: null, remainingMs: 0 },
    completed: true,
  };
}

/**
 * Rebuilds a countdown from a stored snapshot after a reload.
 *
 * Returns `null` when the snapshot cannot be trusted: malformed data, a
 * non-positive duration, or a run whose target time already passed while the
 * tab was closed — an expired session is never resurrected or reported as a
 * fresh completion (F005: abandoned timers are not recorded).
 */
export function restoreCountdown(snapshot: CountdownSnapshot, now: number): CountdownState | null {
  const durationMs = snapshot.durationMs;
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }

  if (snapshot.status === "running") {
    const endsAt = snapshot.endsAt;
    if (typeof endsAt !== "number" || !Number.isFinite(endsAt)) return null;
    if (endsAt <= now) return null;
    return {
      status: "running",
      durationMs,
      endsAt,
      remainingMs: Math.max(0, endsAt - now),
    };
  }

  if (snapshot.status !== "paused") return null;

  const remainingMs =
    typeof snapshot.remainingMs === "number" && Number.isFinite(snapshot.remainingMs)
      ? Math.min(durationMs, Math.max(0, snapshot.remainingMs))
      : durationMs;
  if (remainingMs <= 0) return null;

  return { status: "paused", durationMs, endsAt: null, remainingMs };
}
