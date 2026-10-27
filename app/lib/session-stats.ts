import type { SessionRecord } from "@/app/lib/sessions";

/**
 * Pure statistics and streak derivations (F010, F011, F025, F026).
 *
 * Everything takes session history plus an explicit `now`, so day boundaries,
 * weekly totals and streaks are deterministic in tests and always computed in
 * the browser's local timezone — never from UTC ISO strings.
 */

export const DAY_MS = 86_400_000;

/**
 * Local calendar day encoded as days since the epoch.
 *
 * Built from the local Y/M/D components (not `toISOString`), then anchored at
 * UTC midnight so consecutive days differ by exactly 1 even across DST jumps.
 */
export function localDaySerial(timestamp: number): number {
  const date = new Date(timestamp);
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}

/** UTC-midnight Date for a local day serial; safe for labels via `timeZone: "UTC"`. */
export function serialToDate(serial: number): Date {
  return new Date(serial * DAY_MS);
}

export function isFocusSession(session: SessionRecord): boolean {
  return session.mode === "focus";
}

export function getFocusSessions(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.filter(isFocusSession);
}

/* -------------------------------------------------------------------------- */
/* Daily and weekly totals                                                    */
/* -------------------------------------------------------------------------- */

export interface DayTotals {
  sessions: number;
  totalMs: number;
}

export const EMPTY_DAY_TOTALS: DayTotals = { sessions: 0, totalMs: 0 };

/** Focus sessions grouped by local day; breaks are never counted. */
export function summariseByDay(
  sessions: SessionRecord[],
): Map<number, DayTotals> {
  const byDay = new Map<number, DayTotals>();

  for (const session of getFocusSessions(sessions)) {
    const serial = localDaySerial(session.completedAt);
    const current = byDay.get(serial) ?? { sessions: 0, totalMs: 0 };
    current.sessions += 1;
    current.totalMs += session.durationMs;
    byDay.set(serial, current);
  }

  return byDay;
}

export function getDayTotals(
  sessions: SessionRecord[],
  serial: number,
): DayTotals {
  return summariseByDay(sessions).get(serial) ?? EMPTY_DAY_TOTALS;
}

export const FOCUS_RANGES = ["today", "week"] as const;
export type FocusRange = (typeof FOCUS_RANGES)[number];

export const FOCUS_RANGE_LABELS: Record<FocusRange, string> = {
  today: "Today",
  week: "This week",
};

export interface FocusSummary {
  range: FocusRange;
  sessions: number;
  totalMs: number;
}

/** Week starts on Monday, matching the `Mon–Sun` labels in the insights view. */
export function getWeekStartSerial(now: number): number {
  const today = localDaySerial(now);
  const weekday = serialToDate(today).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % 7;
  return today - daysSinceMonday;
}

export interface WeekDay extends DayTotals {
  /** Local day serial. */
  serial: number;
  /** Short weekday label, e.g. "Mon". */
  label: string;
  isToday: boolean;
}

export function getWeekDays(sessions: SessionRecord[], now: number): WeekDay[] {
  const byDay = summariseByDay(sessions);
  const today = localDaySerial(now);
  const start = getWeekStartSerial(now);

  return Array.from({ length: 7 }, (_, index) => {
    const serial = start + index;
    const totals = byDay.get(serial) ?? EMPTY_DAY_TOTALS;

    return {
      serial,
      label: formatWeekday(serial),
      isToday: serial === today,
      sessions: totals.sessions,
      totalMs: totals.totalMs,
    };
  });
}

/** Totals for the selected range: today, or Monday–Sunday of the current week. */
export function getFocusSummary(
  sessions: SessionRecord[],
  now: number,
  range: FocusRange,
): FocusSummary {
  if (range === "today") {
    const totals = getDayTotals(sessions, localDaySerial(now));
    return { range, sessions: totals.sessions, totalMs: totals.totalMs };
  }

  const days = getWeekDays(sessions, now);
  return {
    range,
    sessions: days.reduce((total, day) => total + day.sessions, 0),
    totalMs: days.reduce((total, day) => total + day.totalMs, 0),
  };
}

/** The last `count` local days ending today, oldest first (streak calendar). */
export function getRecentDays(
  sessions: SessionRecord[],
  now: number,
  count = 7,
): WeekDay[] {
  const byDay = summariseByDay(sessions);
  const today = localDaySerial(now);

  return Array.from({ length: count }, (_, index) => {
    const serial = today - count + 1 + index;
    const totals = byDay.get(serial) ?? EMPTY_DAY_TOTALS;

    return {
      serial,
      label: formatWeekday(serial),
      isToday: serial === today,
      sessions: totals.sessions,
      totalMs: totals.totalMs,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Streaks (F025)                                                             */
/* -------------------------------------------------------------------------- */

export interface StreakSummary {
  /** Consecutive focus days ending today or yesterday; 0 when the streak broke. */
  current: number;
  /** Longest consecutive run ever; preserved when the current streak drops. */
  best: number;
  /** Distinct days with at least one completed focus session. */
  activeDays: number;
  lastFocusDay: number | null;
}

/**
 * Derives the streak from history on every call — there is no mutable counter.
 *
 * A day counts once, so two sessions on the same day extend the streak by one.
 * The current streak stays alive until a full day is skipped (today itself is
 * not required yet, otherwise the streak would reset every midnight).
 */
export function getStreakSummary(
  sessions: SessionRecord[],
  now: number,
): StreakSummary {
  const daySerials = [
    ...new Set(getFocusSessions(sessions).map((s) => localDaySerial(s.completedAt))),
  ].sort((a, b) => a - b);

  if (daySerials.length === 0) {
    return { current: 0, best: 0, activeDays: 0, lastFocusDay: null };
  }

  let best = 1;
  let run = 1;

  for (let index = 1; index < daySerials.length; index += 1) {
    if (daySerials[index] === daySerials[index - 1] + 1) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }

  const lastFocusDay = daySerials[daySerials.length - 1];
  const gapToToday = localDaySerial(now) - lastFocusDay;

  let current = 0;
  if (gapToToday === 0 || gapToToday === 1) {
    current = 1;
    for (let index = daySerials.length - 1; index > 0; index -= 1) {
      if (daySerials[index] - daySerials[index - 1] === 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return {
    current,
    best,
    activeDays: daySerials.length,
    lastFocusDay,
  };
}

/* -------------------------------------------------------------------------- */
/* History grouping and formatting (F010)                                     */
/* -------------------------------------------------------------------------- */

export interface SessionDayGroup {
  serial: number;
  /** "Today", "Yesterday" or "Mon, Oct 19". */
  heading: string;
  /** Newest first inside the day. */
  sessions: SessionRecord[];
}

export function groupFocusSessionsByDay(
  sessions: SessionRecord[],
  now: number,
): SessionDayGroup[] {
  const byDay = new Map<number, SessionRecord[]>();

  for (const session of getFocusSessions(sessions)) {
    const serial = localDaySerial(session.completedAt);
    const list = byDay.get(serial) ?? [];
    list.push(session);
    byDay.set(serial, list);
  }

  return [...byDay.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([serial, list]) => ({
      serial,
      heading: formatDayHeading(serial, now),
      sessions: [...list].sort((a, b) => b.completedAt - a.completedAt),
    }));
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});

const HEADING_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const RANGE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatWeekday(serial: number): string {
  return WEEKDAY_FORMATTER.format(serialToDate(serial));
}

export function formatDayHeading(serial: number, now: number): string {
  const today = localDaySerial(now);
  if (serial === today) return "Today";
  if (serial === today - 1) return "Yesterday";
  return HEADING_FORMATTER.format(serialToDate(serial));
}

/** Local wall-clock time of a completion, e.g. "14:32". */
export function formatLocalTime(timestamp: number): string {
  return TIME_FORMATTER.format(new Date(timestamp));
}

/** Date range label for the weekly summary, e.g. "Oct 19 – Oct 25". */
export function formatWeekRange(now: number): string {
  const start = getWeekStartSerial(now);
  const end = start + 6;
  return `${RANGE_FORMATTER.format(serialToDate(start))} – ${RANGE_FORMATTER.format(serialToDate(end))}`;
}

/** Today's local date, e.g. "Sun, Oct 25". */
export function formatTodayLabel(now: number): string {
  return HEADING_FORMATTER.format(serialToDate(localDaySerial(now)));
}

/** Human duration for totals, e.g. "25 min", "1 h 25 min". */
export function formatFocusDuration(ms: number): string {
  const totalMinutes = Math.round(Math.max(0, ms) / 60_000);
  if (totalMinutes <= 0) return "0 min";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
