"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_DURATIONS,
  DURATIONS_STORAGE_KEY,
  DURATIONS_UPDATED_EVENT,
  readStoredDurations,
  type Durations,
} from "@/app/lib/settings";

let cachedRaw: string | null = null;
let cachedValue: Durations = DEFAULT_DURATIONS;

function getSnapshot(): Durations {
  let raw: string | null;

  try {
    raw = window.localStorage.getItem(DURATIONS_STORAGE_KEY);
  } catch {
    return DEFAULT_DURATIONS;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = readStoredDurations();
  }

  return cachedValue;
}

function getServerSnapshot(): Durations {
  return DEFAULT_DURATIONS;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(DURATIONS_UPDATED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(DURATIONS_UPDATED_EVENT, onStoreChange);
  };
}

/**
 * Persisted timer durations.
 *
 * useSyncExternalStore keeps the server render and the first client render in
 * sync (defaults), then swaps in stored values without a setState-in-effect.
 */
export function useDurations(): Durations {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
