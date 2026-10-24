import { TIMER_MODES, type TimerMode } from "@/app/lib/timer";

export interface Durations {
  focus: number;
  short: number;
  long: number;
}

export const DEFAULT_DURATIONS: Durations = {
  focus: 25,
  short: 5,
  long: 15,
};

export const DURATION_LIMITS: Record<TimerMode, { min: number; max: number }> = {
  focus: { min: 1, max: 120 },
  short: { min: 1, max: 60 },
  long: { min: 1, max: 60 },
};

export const DURATIONS_STORAGE_KEY = "pomodoroflow:durations";

/** Same-tab notification so useSyncExternalStore picks up local writes. */
export const DURATIONS_UPDATED_EVENT = "pomodoroflow:durations-updated";

export type DurationErrors = Partial<Record<TimerMode, string>>;

export function isDurationValid(mode: TimerMode, value: number): boolean {
  const { min, max } = DURATION_LIMITS[mode];
  return Number.isInteger(value) && value >= min && value <= max;
}

type ValidationResult =
  | { ok: true; durations: Durations }
  | { ok: false; errors: DurationErrors };

/** Validates raw form input; invalid fields never overwrite stored settings. */
export function validateDurations(
  values: Record<TimerMode, string>,
): ValidationResult {
  const errors: DurationErrors = {};
  const durations = { ...DEFAULT_DURATIONS };

  for (const mode of TIMER_MODES) {
    const { min, max } = DURATION_LIMITS[mode];
    const raw = values[mode].trim();
    const parsed = Number(raw);

    if (raw === "" || !Number.isFinite(parsed)) {
      errors[mode] = "Enter a duration in minutes.";
      continue;
    }

    if (!isDurationValid(mode, parsed)) {
      errors[mode] = `Use a whole number between ${min} and ${max} minutes.`;
      continue;
    }

    durations[mode] = parsed;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, durations };
}

function parseDurations(raw: string | null): Durations | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    const durations = { ...DEFAULT_DURATIONS };
    let matched = false;

    for (const mode of TIMER_MODES) {
      const value = candidate[mode];
      if (typeof value === "number" && isDurationValid(mode, value)) {
        durations[mode] = value;
        matched = true;
      }
    }

    return matched ? durations : null;
  } catch {
    return null;
  }
}

/** Reads persisted durations, falling back to defaults for malformed data. */
export function readStoredDurations(): Durations {
  if (typeof window === "undefined") return DEFAULT_DURATIONS;

  try {
    return parseDurations(window.localStorage.getItem(DURATIONS_STORAGE_KEY)) ?? DEFAULT_DURATIONS;
  } catch {
    return DEFAULT_DURATIONS;
  }
}

export function writeStoredDurations(durations: Durations): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DURATIONS_STORAGE_KEY, JSON.stringify(durations));
    window.dispatchEvent(new Event(DURATIONS_UPDATED_EVENT));
  } catch {
    // Storage may be unavailable (private mode, quota); defaults keep the app usable.
  }
}
