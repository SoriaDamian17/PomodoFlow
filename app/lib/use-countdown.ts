"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createCountdown,
  pauseCountdown,
  resetCountdown,
  restoreCountdown,
  startCountdown,
  tickCountdown,
  type CountdownState,
  type TimerStatus,
} from "@/app/lib/countdown-core";
import { formatClock, type TimerMode } from "@/app/lib/timer";
import {
  clearTimerSnapshot,
  readTimerSnapshot,
  writeTimerSnapshot,
  type TimerSnapshot,
} from "@/app/lib/timer-snapshot";

export type { TimerStatus };

export interface Countdown {
  remainingMs: number;
  status: TimerStatus;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  /** Restores an in-progress run after a reload (F027). */
  restore: (snapshot: TimerSnapshot) => void;
}

export interface UseCountdownOptions {
  /** Mode the countdown belongs to; stored with the snapshot so a reload restores the right stage. */
  mode: TimerMode;
  /** Fires exactly once per completed run — never on pause, reset or double-mounted effects. */
  onComplete?: () => void;
}

const TICK_INTERVAL_MS = 200;
/** A pending restore only ever applies to the render triggered right after it was requested. */
const RESTORE_WINDOW_MS = 5_000;

/**
 * Timestamp-based countdown (F027).
 *
 * Remaining time is always `endsAt - Date.now()`, never an interval decrement,
 * so background tabs, throttled timers and device sleep cannot make the clock
 * drift. The clock is re-read on `visibilitychange`/`focus` for an immediate
 * correction after sleep, `document.title` mirrors the remaining time while
 * running, and an in-progress run is written to storage so a reload restores
 * it from its stored target time. Completion is emitted exactly once.
 */
export function useCountdown(durationMs: number, options: UseCountdownOptions): Countdown {
  const { mode, onComplete } = options;

  const safeDurationMs = Math.max(0, durationMs);
  const [state, setState] = useState<CountdownState>(() => createCountdown(safeDurationMs));
  const stateRef = useRef(state);
  const durationRef = useRef(safeDurationMs);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  });

  const pendingRestoreRef = useRef<{ snapshot: TimerSnapshot; requestedAt: number } | null>(null);

  const commit = useCallback((next: CountdownState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const persist = useCallback((next: CountdownState) => {
    if (next.status === "running" || next.status === "paused") {
      writeTimerSnapshot({
        mode: modeRef.current,
        status: next.status,
        durationMs: next.durationMs,
        endsAt: next.endsAt,
        remainingMs: next.remainingMs,
        updatedAt: Date.now(),
      });
    } else {
      clearTimerSnapshot();
    }
  }, []);

  const apply = useCallback(
    (next: CountdownState) => {
      commit(next);
      persist(next);
    },
    [commit, persist],
  );

  // Switching mode or saving new settings restarts the stage with the new
  // length — unless a reload restore is waiting for exactly that length.
  useEffect(() => {
    if (durationRef.current === safeDurationMs) return;
    durationRef.current = safeDurationMs;

    const pending = pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    const isFresh =
      pending !== null && Date.now() - pending.requestedAt <= RESTORE_WINDOW_MS;

    if (isFresh && pending.snapshot.durationMs === safeDurationMs) {
      const restored = restoreCountdown(pending.snapshot, Date.now());
      if (restored) {
        apply(restored);
        return;
      }
    }

    // Stored durations are swapped in after hydration, so this effect also runs
    // on a plain reload. Pick the stored run back up when it belongs to the
    // newly hydrated length instead of wiping it (F027/F012).
    const stored = readTimerSnapshot();
    if (stored?.durationMs === safeDurationMs) {
      const restored = restoreCountdown(stored, Date.now());
      if (restored) {
        apply(restored);
        return;
      }
    }

    // A genuinely new length starts fresh and drops any stale snapshot.
    apply(createCountdown(safeDurationMs));
  }, [safeDurationMs, apply]);

  // The tick loop only exists while running: one immediate read plus a fast
  // interval, both recomputed from the target timestamp.
  useEffect(() => {
    if (state.status !== "running") return;

    const tickNow = () => {
      const current = stateRef.current;
      if (current.status !== "running") return;

      const { state: next, completed } = tickCountdown(current, Date.now());
      if (next !== current) commit(next);

      if (completed) {
        clearTimerSnapshot();
        onCompleteRef.current?.();
      }
    };

    tickNow();
    const interval = window.setInterval(tickNow, TICK_INTERVAL_MS);
    document.addEventListener("visibilitychange", tickNow);
    window.addEventListener("focus", tickNow);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tickNow);
      window.removeEventListener("focus", tickNow);
    };
  }, [state.status, commit]);

  // `document.title` mirrors the remaining time while running and is restored
  // the moment the timer stops (F027).
  const originalTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === "running") {
      if (originalTitleRef.current === null) originalTitleRef.current = document.title;
      document.title = `${formatClock(state.remainingMs)} · ${originalTitleRef.current}`;
    } else if (originalTitleRef.current !== null) {
      document.title = originalTitleRef.current;
      originalTitleRef.current = null;
    }
  }, [state.status, state.remainingMs]);

  useEffect(
    () => () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
        originalTitleRef.current = null;
      }
    },
    [],
  );

  const start = useCallback(() => {
    apply(startCountdown(stateRef.current, Date.now()));
  }, [apply]);

  const pause = useCallback(() => {
    apply(pauseCountdown(stateRef.current, Date.now()));
  }, [apply]);

  const reset = useCallback(() => {
    apply(resetCountdown(stateRef.current));
  }, [apply]);

  const toggle = useCallback(() => {
    if (stateRef.current.status === "running") {
      pause();
    } else {
      start();
    }
  }, [pause, start]);

  const restore = useCallback(
    (snapshot: TimerSnapshot) => {
      if (snapshot.durationMs === durationRef.current) {
        const restored = restoreCountdown(snapshot, Date.now());
        if (restored) apply(restored);
        return;
      }
      // The caller is about to switch mode; the duration effect applies it.
      pendingRestoreRef.current = { snapshot, requestedAt: Date.now() };
    },
    [apply],
  );

  return {
    // Pure: derived from the state committed by the tick loop, never from a
    // clock read during render.
    remainingMs: state.remainingMs,
    status: state.status,
    start,
    pause,
    toggle,
    reset,
    restore,
  };
}
