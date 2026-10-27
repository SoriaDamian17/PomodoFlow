"use client";

import { useSyncExternalStore } from "react";

/**
 * Coarse clock for statistics and streak labels (F011 / F025 / F026).
 *
 * Reading `Date.now()` directly in render is impure: two renders could observe
 * different days. `useSyncExternalStore` keeps the value stable between ticks
 * and re-renders when the minute changes or the tab regains focus, which is
 * frequent enough for "today"/"this week" boundaries.
 */
const CLOCK_TICK_MS = 30_000;

function subscribeToClock(onStoreChange: () => void): () => void {
  const interval = window.setInterval(onStoreChange, CLOCK_TICK_MS);
  window.addEventListener("focus", onStoreChange);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("focus", onStoreChange);
  };
}

function getClockSnapshot(): number {
  // Quantized so repeated reads within the same tick return an identical value.
  return Math.floor(Date.now() / CLOCK_TICK_MS) * CLOCK_TICK_MS;
}

/** 0 during the server render/hydration pass, so markup stays deterministic. */
function getServerClockSnapshot(): number {
  return 0;
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );
}
