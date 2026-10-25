import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@/app/lib/sessions";
import {
  formatDayHeading,
  formatFocusDuration,
  getDayTotals,
  getFocusSummary,
  getRecentDays,
  getStreakSummary,
  getWeekDays,
  getWeekStartSerial,
  groupFocusSessionsByDay,
  localDaySerial,
  summariseByDay,
} from "@/app/lib/session-stats";

const MINUTE = 60_000;
const FOCUS_MS = 25 * MINUTE;
const BREAK_MS = 5 * MINUTE;

/** Fixed local "now": Sunday, Oct 25 2026 at noon (day boundaries are local). */
const NOW = new Date(2026, 9, 25, 12, 0, 0).getTime();

/** Local timestamp `daysAgo` days before NOW, at a given local hour. */
function at(daysAgo: number, hour = 12, minute = 0): number {
  return new Date(2026, 9, 25 - daysAgo, hour, minute, 0).getTime();
}

let counter = 0;
function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  counter += 1;
  return {
    id: `session-${counter}`,
    mode: "focus",
    durationMs: FOCUS_MS,
    completedAt: NOW,
    ...overrides,
  };
}

function focusAt(timestamp: number, durationMs = FOCUS_MS): SessionRecord {
  return session({ mode: "focus", completedAt: timestamp, durationMs });
}

describe("localDaySerial", () => {
  it("keeps a whole local day on one serial", () => {
    expect(localDaySerial(at(0, 0, 1))).toBe(localDaySerial(at(0, 23, 59)));
  });

  it("increments by exactly one per local calendar day", () => {
    const serials = [0, 1, 2, 3].map((daysAgo) => localDaySerial(at(daysAgo)));
    expect(serials[0] - serials[1]).toBe(1);
    expect(serials[1] - serials[2]).toBe(1);
    expect(serials[2] - serials[3]).toBe(1);
  });

  it("crosses a month boundary in local time", () => {
    const firstOfMonth = new Date(2026, 10, 1, 9, 0, 0).getTime();
    const lastOfPrevious = new Date(2026, 9, 31, 23, 0, 0).getTime();
    expect(localDaySerial(firstOfMonth) - localDaySerial(lastOfPrevious)).toBe(1);
  });
});

describe("daily totals (F011)", () => {
  const sessions = [
    focusAt(at(0, 9)),
    focusAt(at(0, 15), 50 * MINUTE),
    session({ mode: "short", completedAt: at(0, 10), durationMs: BREAK_MS }),
    session({ mode: "long", completedAt: at(0, 11), durationMs: 15 * MINUTE }),
    focusAt(at(1, 9)),
  ];

  it("counts focus sessions and sums their durations", () => {
    const totals = getDayTotals(sessions, localDaySerial(NOW));
    expect(totals.sessions).toBe(2);
    expect(totals.totalMs).toBe(FOCUS_MS + 50 * MINUTE);
  });

  it("never counts breaks in session totals or focus time", () => {
    const byDay = summariseByDay(sessions);
    const today = byDay.get(localDaySerial(NOW));
    expect(today?.sessions).toBe(2);
    expect(today?.totalMs).toBe(FOCUS_MS + 50 * MINUTE);
  });

  it("returns zeroed totals for a day without sessions", () => {
    expect(getDayTotals(sessions, localDaySerial(at(5)))).toEqual({
      sessions: 0,
      totalMs: 0,
    });
  });
});

describe("weekly summary (F026)", () => {
  it("starts the week on Monday", () => {
    // NOW is a Sunday, so the week started six local days earlier.
    expect(getWeekStartSerial(NOW)).toBe(localDaySerial(at(6)));
    const monday = new Date(2026, 9, 19, 8, 0, 0).getTime();
    expect(getWeekStartSerial(monday)).toBe(localDaySerial(monday));
  });

  it("lists seven consecutive days with today flagged", () => {
    const days = getWeekDays([focusAt(at(0, 9))], NOW);
    const serials = days.map((day) => day.serial);

    expect(days).toHaveLength(7);
    expect(serials[0]).toBe(getWeekStartSerial(NOW));
    expect(new Set(serials).size).toBe(7);
    expect(days.filter((day) => day.isToday)).toHaveLength(1);
    expect(days[6].isToday).toBe(true);
  });

  it("summarises today or the whole week depending on the range", () => {
    const sessions = [
      focusAt(at(0, 9)), // Sunday, inside this week
      focusAt(at(0, 18), 30 * MINUTE),
      focusAt(at(3, 9), 40 * MINUTE), // Wednesday, same week
      focusAt(at(6, 9), 20 * MINUTE), // Monday, same week
      focusAt(at(7, 9), 45 * MINUTE), // previous Sunday, outside this week
    ];

    const today = getFocusSummary(sessions, NOW, "today");
    expect(today).toEqual({
      range: "today",
      sessions: 2,
      totalMs: FOCUS_MS + 30 * MINUTE,
    });

    const week = getFocusSummary(sessions, NOW, "week");
    expect(week).toEqual({
      range: "week",
      sessions: 4,
      totalMs: FOCUS_MS + 30 * MINUTE + 40 * MINUTE + 20 * MINUTE,
    });
  });
});

describe("streak summary (F025)", () => {
  it("is empty without focus sessions", () => {
    expect(getStreakSummary([], NOW)).toEqual({
      current: 0,
      best: 0,
      activeDays: 0,
      lastFocusDay: null,
    });
    expect(
      getStreakSummary(
        [session({ mode: "short", completedAt: at(0, 9), durationMs: BREAK_MS })],
        NOW,
      ),
    ).toEqual({ current: 0, best: 0, activeDays: 0, lastFocusDay: null });
  });

  it("counts a day once even with several sessions", () => {
    const streak = getStreakSummary(
      [focusAt(at(0, 9)), focusAt(at(0, 14)), focusAt(at(0, 20))],
      NOW,
    );

    expect(streak.current).toBe(1);
    expect(streak.best).toBe(1);
    expect(streak.activeDays).toBe(1);
  });

  it("counts consecutive days including a still-open today", () => {
    const streak = getStreakSummary(
      [focusAt(at(0, 9)), focusAt(at(1, 9)), focusAt(at(2, 9))],
      NOW,
    );

    expect(streak.current).toBe(3);
    expect(streak.best).toBe(3);
    expect(streak.activeDays).toBe(3);
  });

  it("keeps the streak alive when the last focus day was yesterday", () => {
    const streak = getStreakSummary(
      [focusAt(at(1, 9)), focusAt(at(2, 9))],
      NOW,
    );

    expect(streak.current).toBe(2);
  });

  it("resets the current streak after a skipped day but keeps the best", () => {
    const streak = getStreakSummary(
      [
        // Four-day run in the past...
        focusAt(at(10, 9)),
        focusAt(at(9, 9)),
        focusAt(at(8, 9)),
        focusAt(at(7, 9)),
        // ...then one isolated session two days ago (yesterday was skipped).
        focusAt(at(2, 9)),
      ],
      NOW,
    );

    expect(streak.current).toBe(0);
    expect(streak.best).toBe(4);
    expect(streak.activeDays).toBe(5);
  });

  it("keeps today's run when it follows a break in an older run", () => {
    const streak = getStreakSummary(
      [focusAt(at(6, 9)), focusAt(at(0, 9)), focusAt(at(1, 9))],
      NOW,
    );

    expect(streak.current).toBe(2);
    expect(streak.best).toBe(2);
  });
});

describe("history grouping (F010)", () => {
  const sessions = [
    focusAt(at(1, 8)),
    focusAt(at(1, 20)),
    focusAt(at(0, 9)),
    focusAt(at(3, 9)),
    session({ mode: "short", completedAt: at(0, 10), durationMs: BREAK_MS }),
  ];

  it("groups focus sessions per local day, newest day first", () => {
    const groups = groupFocusSessionsByDay(sessions, NOW);

    expect(groups.map((group) => group.serial)).toEqual([
      localDaySerial(at(0)),
      localDaySerial(at(1)),
      localDaySerial(at(3)),
    ]);
  });

  it("orders sessions inside a day newest first and excludes breaks", () => {
    const groups = groupFocusSessionsByDay(sessions, NOW);
    const yesterday = groups[1];

    expect(yesterday.sessions.map((item) => item.completedAt)).toEqual([
      at(1, 20),
      at(1, 8),
    ]);
    expect(
      groups.flatMap((group) => group.sessions).every((item) => item.mode === "focus"),
    ).toBe(true);
  });

  it("labels today and yesterday, then uses a dated heading", () => {
    const groups = groupFocusSessionsByDay(sessions, NOW);
    expect(groups[0].heading).toBe("Today");
    expect(groups[1].heading).toBe("Yesterday");
    expect(groups[2].heading).not.toBe("Today");
    expect(groups[2].heading).not.toBe("Yesterday");
    expect(formatDayHeading(localDaySerial(at(0)), NOW)).toBe("Today");
  });
});

describe("getRecentDays", () => {
  it("returns the last seven local days, oldest first, ending today", () => {
    const days = getRecentDays([focusAt(at(0, 9)), focusAt(at(6, 9))], NOW, 7);

    expect(days).toHaveLength(7);
    expect(days[0].serial).toBe(localDaySerial(at(6)));
    expect(days[6].isToday).toBe(true);
    expect(days[6].sessions).toBe(1);
    expect(days[0].sessions).toBe(1);
    expect(days[3].sessions).toBe(0);
  });
});

describe("formatFocusDuration", () => {
  it("formats minutes and hours without trailing zeros", () => {
    expect(formatFocusDuration(0)).toBe("0 min");
    expect(formatFocusDuration(25 * MINUTE)).toBe("25 min");
    expect(formatFocusDuration(60 * MINUTE)).toBe("1 h");
    expect(formatFocusDuration(85 * MINUTE)).toBe("1 h 25 min");
  });
});
