"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TimerStatus = "idle" | "running" | "paused" | "completed";

export interface Countdown {
  remainingMs: number;
  status: TimerStatus;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
}

const TICK_INTERVAL_MS = 200;

/**
 * Timestamp-based countdown.
 *
 * Remaining time is always `endsAt - Date.now()`, never an interval decrement, so
 * background tabs, throttled timers and device sleep cannot make the clock drift.
 * Completion is emitted exactly once because the tick stops as soon as it hits 0.
 */
export function useCountdown(durationMs: number): Countdown {
  const safeDuration = Math.max(0, durationMs);
  const [remainingMs, setRemainingMs] = useState(safeDuration);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const endsAtRef = useRef<number | null>(null);
  const durationRef = useRef(safeDuration);

  // Switching mode or saving new settings restarts the stage with the new length.
  useEffect(() => {
    if (durationRef.current === safeDuration) return;
    durationRef.current = safeDuration;
    endsAtRef.current = null;
    setRemainingMs(safeDuration);
    setStatus("idle");
  }, [safeDuration]);

  useEffect(() => {
    if (status !== "running") return;

    const tick = () => {
      const endsAt = endsAtRef.current;
      if (endsAt === null) return;

      const next = Math.max(0, endsAt - Date.now());
      setRemainingMs(next);

      if (next === 0) {
        endsAtRef.current = null;
        setStatus("completed");
      }
    };

    tick();
    const interval = window.setInterval(tick, TICK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [status]);

  const start = useCallback(() => {
    if (status === "running") return;

    const base =
      status === "completed" || remainingMs <= 0 ? safeDuration : remainingMs;

    endsAtRef.current = Date.now() + base;
    setRemainingMs(base);
    setStatus("running");
  }, [status, remainingMs, safeDuration]);

  const pause = useCallback(() => {
    if (status !== "running") return;

    const endsAt = endsAtRef.current;
    if (endsAt !== null) {
      setRemainingMs(Math.max(0, endsAt - Date.now()));
    }
    endsAtRef.current = null;
    setStatus("paused");
  }, [status]);

  const reset = useCallback(() => {
    endsAtRef.current = null;
    setRemainingMs(safeDuration);
    setStatus("idle");
  }, [safeDuration]);

  const toggle = useCallback(() => {
    if (status === "running") {
      pause();
    } else {
      start();
    }
  }, [status, pause, start]);

  return { remainingMs, status, start, pause, toggle, reset };
}
