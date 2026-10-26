"use client";

import { useSyncExternalStore } from "react";
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  AUDIO_SETTINGS_UPDATED_EVENT,
  DEFAULT_AUDIO_SETTINGS,
  readStoredAudioSettings,
  type AudioSettings,
} from "@/app/lib/audio";

let cachedRaw: string | null = null;
let cachedValue: AudioSettings = DEFAULT_AUDIO_SETTINGS;

function getSnapshot(): AudioSettings {
  let raw: string | null;

  try {
    raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = readStoredAudioSettings();
  }

  return cachedValue;
}

function getServerSnapshot(): AudioSettings {
  return DEFAULT_AUDIO_SETTINGS;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(AUDIO_SETTINGS_UPDATED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(AUDIO_SETTINGS_UPDATED_EVENT, onStoreChange);
  };
}

/**
 * Persisted player settings (track, volume, mute).
 *
 * Like durations, this uses useSyncExternalStore so the server render and the
 * hydration pass both see the defaults, then the stored values are swapped in
 * without a setState-in-effect.
 */
export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
