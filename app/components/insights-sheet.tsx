"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/app/lib/cn";
import type { SessionRecord } from "@/app/lib/sessions";
import {
  FOCUS_RANGES,
  FOCUS_RANGE_LABELS,
  formatFocusDuration,
  formatLocalTime,
  formatTodayLabel,
  formatWeekRange,
  getFocusSummary,
  getWeekDays,
  groupFocusSessionsByDay,
  type FocusRange,
  type SessionDayGroup,
  type WeekDay,
} from "@/app/lib/session-stats";
import { useNow } from "@/app/lib/use-now";
import { ChecklistIcon } from "@/app/components/icons";
import { Sheet } from "@/app/components/sheet";
import { StorageNotice } from "@/app/components/storage-notice";

interface InsightsSheetProps {
  open: boolean;
  onClose: () => void;
  sessions: SessionRecord[];
  ready: boolean;
  storageAvailable: boolean;
  /** Optional context rendered in the sheet header (F022 timer indicator). */
  headerExtra?: ReactNode;
}

/**
 * Focus insights: daily/weekly statistics plus the session history surface
 * (F010, F011, F026).
 *
 * All totals are derived from the recorded sessions on every render, in local
 * time, so a completed session shows up without a reload and there is no
 * second source of truth to drift.
 */
export function InsightsSheet({
  open,
  onClose,
  sessions,
  ready,
  storageAvailable,
  headerExtra,
}: InsightsSheetProps) {
  const [range, setRange] = useState<FocusRange>("today");
  const now = useNow();
  // `now` is 0 during the server/hydration pass; hold the loading state then so
  // the server markup and the first client render agree.
  const showContent = ready && now > 0;

  const summary = getFocusSummary(sessions, now, range);
  const weekDays = getWeekDays(sessions, now);
  const history = showContent ? groupFocusSessionsByDay(sessions, now) : [];
  const historyCount = history.reduce(
    (total, group) => total + group.sessions.length,
    0,
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Focus insights"
      description="Daily totals and your week at a glance."
      headerExtra={headerExtra}
    >
      <div className="flex flex-col gap-5">
        <StorageNotice show={!storageAvailable}>
          Session history cannot be loaded right now: browser storage is
          unavailable. New sessions will not be saved during this visit.
        </StorageNotice>

        <div
          role="group"
          aria-label="Statistics range"
          className="flex gap-1 rounded-full border border-glass-border bg-foreground/5 p-1"
        >
          {FOCUS_RANGES.map((option) => {
            const isActive = option === range;

            return (
              <button
                key={option}
                type="button"
                aria-pressed={isActive}
                onClick={() => setRange(option)}
                className={cn(
                  "h-10 flex-1 rounded-full border px-3 text-xs font-medium transition-colors",
                  isActive
                    ? "border-accent-text/50 bg-accent/15 text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {FOCUS_RANGE_LABELS[option]}
              </button>
            );
          })}
        </div>

        {!showContent ? (
          <p className="text-xs text-muted" role="status">
            Loading focus history…
          </p>
        ) : (
          <>
            <section
              aria-label={`${FOCUS_RANGE_LABELS[range]} focus summary`}
              className="flex flex-col gap-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">
                  {FOCUS_RANGE_LABELS[range]}
                </h3>
                <p className="text-[11px] text-muted">
                  {range === "today"
                    ? formatTodayLabel(now)
                    : formatWeekRange(now)}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-2.5">
                <StatCard label="Sessions" value={String(summary.sessions)} />
                <StatCard
                  label="Focus time"
                  value={formatFocusDuration(summary.totalMs)}
                />
              </dl>

              {summary.sessions === 0 ? (
                <p className="rounded-2xl border border-dashed border-glass-border px-3.5 py-3 text-xs leading-relaxed text-muted">
                  {range === "today"
                    ? "No focus sessions today yet. Start the timer and finish a session to see your totals here."
                    : "No focus sessions this week yet. Finish a session to start filling the week."}
                </p>
              ) : null}
            </section>

            {range === "week" ? (
              <section
                aria-label="Focus minutes per day this week"
                className="flex flex-col gap-2"
              >
                <h3 className="text-sm font-medium text-foreground">Per day</h3>
                <WeekBreakdown days={weekDays} />
              </section>
            ) : null}

            <SessionHistory history={history} total={historyCount} />
          </>
        )}
      </div>
    </Sheet>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-glass-border bg-foreground/5 px-3.5 py-3">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

function WeekBreakdown({ days }: { days: WeekDay[] }) {
  const maxMs = Math.max(...days.map((day) => day.totalMs), 1);

  return (
    <ul aria-label="Focus minutes per day this week" className="flex flex-col gap-1.5">
      {days.map((day) => {
        const width =
          day.totalMs === 0
            ? 0
            : Math.max(8, Math.round((day.totalMs / maxMs) * 100));

        return (
          <li key={day.serial} className="flex items-center gap-2">
            <span
              className={cn(
                "w-9 shrink-0 text-[11px] font-medium",
                day.isToday ? "text-accent-text" : "text-muted",
              )}
            >
              {day.label}
            </span>
            <span
              aria-hidden="true"
              className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10"
            >
              <span
                className="block h-full rounded-full bg-accent-strong"
                style={{ width: `${width}%` }}
              />
            </span>
            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-foreground">
              {day.totalMs === 0 ? "—" : formatFocusDuration(day.totalMs)}
            </span>
            <span className="sr-only">
              {day.isToday ? "Today, " : ""}
              {day.sessions === 0
                ? "no sessions"
                : `${day.sessions} ${day.sessions === 1 ? "session" : "sessions"}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SessionHistory({
  history,
  total,
}: {
  history: SessionDayGroup[];
  total: number;
}) {
  return (
    <section aria-label="Session history" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Session history</h3>
        {total > 0 ? (
          <p className="text-[11px] text-muted">
            {total} focus {total === 1 ? "session" : "sessions"}
          </p>
        ) : null}
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-glass-border px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">No sessions yet</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Finish a focus session and it will appear here with its time, length
            and task.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {history.map((group) => (
            <div key={group.serial}>
              <h4 className="text-[11px] font-medium tracking-wide text-muted uppercase">
                {group.heading}
              </h4>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {group.sessions.map((session) => (
                  <li
                    key={session.id}
                    className="rounded-2xl border border-glass-border bg-foreground/5 px-3.5 py-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {formatFocusDuration(session.durationMs)}
                      </p>
                      <time
                        dateTime={new Date(session.completedAt).toISOString()}
                        className="text-[11px] tabular-nums text-muted"
                      >
                        {formatLocalTime(session.completedAt)}
                      </time>
                    </div>
                    {session.taskTitle ? (
                      <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
                        <ChecklistIcon
                          aria-hidden="true"
                          className="mt-0.5 size-3 shrink-0"
                        />
                        <span className="break-words">{session.taskTitle}</span>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
