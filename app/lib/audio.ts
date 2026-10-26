/**
 * Ambient audio catalog and persisted player settings (F023).
 *
 * Tracks are short, seamless-sounding loops generated in-repo with
 * `scripts/generate-audio.mjs` (see docs/audio.md), so there is no third-party
 * license to track. They ship in the service worker precache, so every track is
 * playable offline right after the first visit (F023/F033).
 */

export interface AudioTrack {
  id: string;
  title: string;
  description: string;
  /** Public URL, served from public/audio. */
  src: string;
}

export const AUDIO_TRACKS: readonly AudioTrack[] = [
  {
    id: "rain-on-the-pond",
    title: "Rain on the pond",
    description: "Soft rain over still water.",
    src: "/audio/rain-on-the-pond.mp3",
  },
  {
    id: "forest-at-dusk",
    title: "Forest at dusk",
    description: "Low warm pads with distant leaves.",
    src: "/audio/forest-at-dusk.mp3",
  },
  {
    id: "night-waves",
    title: "Night waves",
    description: "Slow swells under a quiet sky.",
    src: "/audio/night-waves.mp3",
  },
];

export const DEFAULT_TRACK_ID = AUDIO_TRACKS[0].id;

export interface AudioSettings {
  trackId: string;
  /** 0–1. The slider exposes 0–100. */
  volume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  trackId: DEFAULT_TRACK_ID,
  volume: 0.6,
  muted: false,
};

export const AUDIO_SETTINGS_STORAGE_KEY = "pomodoroflow:audio";

/** Same-tab notification so useSyncExternalStore picks up local writes. */
export const AUDIO_SETTINGS_UPDATED_EVENT = "pomodoroflow:audio-updated";

export function isAudioTrackId(value: unknown): value is string {
  return (
    typeof value === "string" && AUDIO_TRACKS.some((track) => track.id === value)
  );
}

/** Falls back to the first track for ids that are no longer in the catalog. */
export function getAudioTrack(id: string): AudioTrack {
  return AUDIO_TRACKS.find((track) => track.id === id) ?? AUDIO_TRACKS[0];
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUDIO_SETTINGS.volume;
  return Math.min(1, Math.max(0, value));
}

/**
 * Defensive parser for the stored payload (F012): each malformed field falls
 * back to its default instead of discarding the whole player state, and
 * unparsable JSON returns null so the caller can use the defaults.
 */
export function parseAudioSettings(raw: string | null): AudioSettings | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;

    return {
      trackId: isAudioTrackId(candidate.trackId)
        ? candidate.trackId
        : DEFAULT_AUDIO_SETTINGS.trackId,
      volume:
        typeof candidate.volume === "number"
          ? clampVolume(candidate.volume)
          : DEFAULT_AUDIO_SETTINGS.volume,
      muted:
        typeof candidate.muted === "boolean"
          ? candidate.muted
          : DEFAULT_AUDIO_SETTINGS.muted,
    };
  } catch {
    return null;
  }
}

/** Reads persisted player settings, falling back to defaults for bad data. */
export function readStoredAudioSettings(): AudioSettings {
  if (typeof window === "undefined") return DEFAULT_AUDIO_SETTINGS;

  try {
    return (
      parseAudioSettings(window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY)) ??
      DEFAULT_AUDIO_SETTINGS
    );
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

/**
 * Persists the selected track, volume and mute state. Playback itself is never
 * persisted: reloading must not autoplay (F023).
 */
export function writeStoredAudioSettings(settings: AudioSettings): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      AUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
    window.dispatchEvent(new Event(AUDIO_SETTINGS_UPDATED_EVENT));
  } catch {
    // Storage may be unavailable (private mode, quota); the current session
    // still works, it just cannot remember the choice.
  }
}
