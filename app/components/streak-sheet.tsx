"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";
import type { SessionRecord } from "@/app/lib/sessions";
import {
  formatFocusDuration,
  getFocusSummary,
  getRecentDays,
  getStreakSummary,
  type WeekDay,
} from "@/app/lib/session-stats";
import { useNow } from "@/app/lib/use-now";
import { FlameIcon } from "@/app/components/icons";
import { Sheet } from "@/app/components/sheet";
import { StorageNotice } from "@/app/components/storage-notice";

interface StreakSheetProps {
  open: boolean;
  onClose: () => void;
  sessions: SessionRecord[];
  ready: boolean;
  storageAvailable: boolean;
  /** Optional context rendered in the sheet header (F022 timer indicator). */
  headerExtra?: ReactNode;
}

/**
 * Streak view (F025): current and best consecutive focus days, derived from
 * session history every render — never from a separately mutable counter.
 */
export function StreakSheet({
  open,
  onClose,
  sessions,
  ready,
  storageAvailable,
  headerExtra,
}: StreakSheetProps) {
  const now = useNow();
  // `now` is 0 during the server/hydration pass; hold the loading state then.
  const showContent = ready && now > 0;
  const streak = getStreakSummary(sessions, now);
  const today = getFocusSummary(sessions, now, "today");
  const recentDays = getRecentDays(sessions, now, 7);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Streak"
      description="Keep the flame alive."
      headerExtra={headerExtra}
    >
      <div className="flex flex-col gap-5">
        <StorageNotice show={!storageAvailable}>
          Streak data cannot be loaded right now: browser storage is
          unavailable. New sessions will not be saved during this visit.
        </StorageNotice>

        {!showContent ? (
          <p className="text-xs text-muted" role="status">
            Loading streak…
          </p>
        ) : (
          <>
            <section
              aria-label="Current streak"
              className="flex items-center gap-4 rounded-3xl border border-glass-border bg-foreground/5 px-5 py-5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-14 shrink-0 place-items-center rounded-full",
                  streak.current > 0
                    ? "bg-accent/15 text-accent-text"
                    : "bg-foreground/10 text-muted",
                )}
              >
                <FlameIcon className="size-7" />
              </span>
              <div className="min-w-0">
                <p className="text-3xl leading-none font-semibold tabular-nums text-foreground">
                  {streak.current}
                  <span className="ml-1.5 text-sm font-medium text-muted">
                    {streak.current === 1 ? "day" : "days"}
                  </span>
                </p>
                <p className="mt-1.5 text-xs text-muted">
                  {streak.current === 0 ? "No active streak" : "Current streak"}
                </p>
              </div>
            </section>

            <dl className="grid grid-cols-2 gap-2.5">
              <StatCard
                label="Best streak"
                value={`${streak.best} ${streak.best === 1 ? "day" : "days"}`}
              />
              <StatCard label="Active days" value={String(streak.activeDays)} />
              <StatCard
                label="Focus today"
                value={formatFocusDuration(today.totalMs)}
              />
              <StatCard
                label="Sessions today"
                value={String(today.sessions)}
              />
            </dl>

            <section
              aria-label="Last seven days"
              className="flex flex-col gap-2"
            >
              <h3 className="text-sm font-medium text-foreground">
                Last 7 days
              </h3>
              <ul className="flex items-end justify-between gap-1">
                {recentDays.map((day) => (
                  <RecentDay key={day.serial} day={day} />
                ))}
              </ul>
            </section>

            {streak.activeDays === 0 ? (
              <div className="rounded-2xl border border-dashed border-glass-border px-4 py-5">
                <p className="text-sm font-medium text-foreground">
                  Start your streak today
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  A streak counts the consecutive days where you finish at
                  least one focus session. Finish one today to light the flame;
                  skipping a full day resets the current streak but keeps your
                  best.
                </p>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted">
                A day counts once you finish at least one focus session, so two
                sessions on the same day add one day to the streak. Skipping a
                full day resets the current streak; your best is preserved.
              </p>
            )}
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

function RecentDay({ day }: { day: WeekDay }) {
  const hasFocus = day.sessions > 0;

  return (
    <li className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-7 place-items-center rounded-full border text-[10px] font-semibold",
          hasFocus
            ? "border-accent-text/60 bg-accent/20 text-accent-text"
            : "border-glass-border bg-foreground/5 text-muted",
        )}
      >
        {hasFocus ? day.sessions : ""}
      </span>
      <span
        className={cn(
          "text-[10px] font-medium",
          day.isToday ? "text-accent-text" : "text-muted",
        )}
      >
        {day.label}
      </span>
      <span className="sr-only">
        {day.isToday ? "Today, " : ""}
        {hasFocus
          ? `${day.sessions} ${day.sessions === 1 ? "session" : "sessions"}, ${formatFocusDuration(day.totalMs)}`
          : "no sessions"}
      </span>
    </li>
  );
}
