export const TIMER_MODES = ["focus", "short", "long"] as const;

export type TimerMode = (typeof TIMER_MODES)[number];

export function isTimerMode(value: unknown): value is TimerMode {
  return TIMER_MODES.includes(value as TimerMode);
}

export interface ModeMeta {
  id: TimerMode;
  /** Label shown in the mode tabs, matching the draft. */
  label: string;
  /** Label shown inside the timer pill. */
  sessionLabel: string;
}

export const MODE_META: Record<TimerMode, ModeMeta> = {
  focus: { id: "focus", label: "Focus", sessionLabel: "Focus session" },
  short: { id: "short", label: "Short Break", sessionLabel: "Short break" },
  long: { id: "long", label: "Long Break", sessionLabel: "Long break" },
};

export const MINUTE_MS = 60_000;

export function minutesToMs(minutes: number): number {
  return Math.max(0, minutes) * MINUTE_MS;
}

/** Formats a duration as MM:SS (never negative). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Screen-reader friendly remaining time, e.g. "24 minutes 30 seconds remaining". */
export function describeClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  if (totalSeconds === 0) return "Session complete";

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds > 0) parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  return `${parts.join(" ")} remaining`;
}
