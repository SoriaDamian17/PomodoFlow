"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/app/lib/cn";
import { writeStoredDurations, type Durations } from "@/app/lib/settings";
import { buildSessionInput, recordSession } from "@/app/lib/sessions";
import type { Surface } from "@/app/lib/surfaces";
import { MODE_META, minutesToMs, type TimerMode } from "@/app/lib/timer";
import {
  isRestorableTimerSnapshot,
  readTimerSnapshot,
} from "@/app/lib/timer-snapshot";
import { useActiveTaskId, useTasks } from "@/app/lib/use-tasks";
import { useAudioPlayer } from "@/app/lib/use-audio-player";
import { useCountdown } from "@/app/lib/use-countdown";
import { useDurations } from "@/app/lib/use-durations";
import { useNow } from "@/app/lib/use-now";
import { useSessions } from "@/app/lib/use-sessions";
import { formatFocusDuration, getFocusSummary } from "@/app/lib/session-stats";
import { BottomNav } from "@/app/components/bottom-nav";
import { InsightsSheet } from "@/app/components/insights-sheet";
import { ModeTabs } from "@/app/components/mode-tabs";
import { MusicSheet } from "@/app/components/music-sheet";
import { NavRail } from "@/app/components/nav-rail";
import { SettingsSheet } from "@/app/components/settings-sheet";
import { StreakSheet } from "@/app/components/streak-sheet";
import { TasksSheet } from "@/app/components/tasks-sheet";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { TimerRing } from "@/app/components/timer-ring";
import { TimerStatusPill } from "@/app/components/timer-status";
import { IconButton } from "@/app/components/icon-button";
import {
  AlertIcon,
  ChecklistIcon,
  CloseIcon,
  GearIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  TimerIcon,
} from "@/app/components/icons";
import type { ComponentType, SVGProps } from "react";

export function PomodoroDashboard() {
  const [mode, setMode] = useState<TimerMode>("focus");
  const durations = useDurations();
  const [surface, setSurface] = useState<Surface | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const audio = useAudioPlayer();
  const { tasks, ready, storageAvailable, createTask, updateTask, deleteTask } =
    useTasks();
  const {
    sessions,
    ready: sessionsReady,
    storageAvailable: sessionsStorageAvailable,
  } = useSessions();
  const [activeTaskId, setActiveTaskId] = useActiveTaskId();
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;

  /** Any unavailable storage surface downgrades persistence for the whole app. */
  const storageUnavailable = !storageAvailable || !sessionsStorageAvailable;

  // F011: daily statistics on the dashboard itself, recomputed from history.
  const now = useNow();
  const showTodayStats = sessionsReady && now > 0;
  const todaySummary = getFocusSummary(sessions, now, "today");

  const totalMs = minutesToMs(durations[mode]);
  const meta = MODE_META[mode];

  /** Draft flow: focus is followed by a short break, a break is followed by focus. */
  function nextModeAfter(completedMode: TimerMode): TimerMode {
    return completedMode === "focus" ? "short" : "focus";
  }

  // F005: the countdown emits exactly one completion, so exactly one session
  // record and one announcement are produced per finished run — resets and
  // abandoned timers never reach this handler.
  function handleComplete() {
    const completedMode = mode;
    const nextMode = nextModeAfter(completedMode);
    const completedAt = Date.now();
    const timeLabel = new Date(completedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // The time keeps consecutive identical announcements distinguishable so
    // the live region re-announces every completion.
    setAnnouncement(
      `${MODE_META[completedMode].label} session complete at ${timeLabel}. Next up: ${MODE_META[nextMode].label}.`,
    );

    // F009: the completion snapshots the selected task's id *and* title, so a
    // later edit/delete never rewrites an already completed session.
    void recordSession(
      buildSessionInput({
        mode: completedMode,
        durationMs: minutesToMs(durations[completedMode]),
        completedAt,
        activeTask,
      }),
    );
  }

  const { remainingMs, status, toggle, reset, restore } = useCountdown(totalMs, {
    mode,
    onComplete: handleComplete,
  });
  const isRunning = status === "running";
  const activeSurface: Surface = surface ?? "timer";

  // F027: restore an in-progress run from its stored target time on load.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const snapshot = readTimerSnapshot();
    if (!snapshot) return;
    if (snapshot.durationMs !== minutesToMs(durations[snapshot.mode])) return;
    if (!isRestorableTimerSnapshot(snapshot)) return;

    // Hydration-gated restore: localStorage is only readable after mount, so
    // the first client render must match the server output before we can swap
    // in the stored mode and countdown. Runs exactly once (restoredRef).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (snapshot.mode !== mode) setMode(snapshot.mode);
    restore(snapshot);
    setAnnouncement("In-progress session restored.");
  }, [mode, durations, restore]);

  function handleModeChange(nextMode: TimerMode) {
    if (nextMode === mode) return;

    // Documented rule: switching modes stops the current session instead of
    // silently carrying its length into the new mode.
    if (status !== "idle") reset();

    setMode(nextMode);
    setAnnouncement(
      `${MODE_META[nextMode].label} mode. ${durations[nextMode]} minutes.`,
    );
  }

  function openSurface(nextSurface: Surface) {
    setSurface(nextSurface === "timer" ? null : nextSurface);
  }

  function closeSurface() {
    setSurface(null);
  }

  function handleSaveDurations(nextDurations: Durations) {
    writeStoredDurations(nextDurations);
    setAnnouncement("Timer settings saved.");
  }

  /** F009: selecting a task announces it and persists the choice. */
  function handleSelectActiveTask(id: string | null) {
    setActiveTaskId(id);

    const task = id ? tasks.find((item) => item.id === id) ?? null : null;
    setAnnouncement(
      task ? `Focus task set to ${task.title}.` : "Focus task cleared.",
    );
  }

  /**
   * Deleting the active task clears the selection, but never touches sessions
   * that already completed against it (they carry their own title snapshot).
   */
  async function handleDeleteTask(id: string): Promise<boolean> {
    const deleted = await deleteTask(id);

    if (deleted && activeTaskId === id) {
      setActiveTaskId(null);
      setAnnouncement("The focus task was deleted.");
    }

    return deleted;
  }

  const startLabel = isRunning ? "Pause" : status === "paused" ? "Resume" : "Start";

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1500px] flex-col px-5 pt-5 pb-28 sm:px-8 sm:pt-7 lg:px-12 lg:pb-8 [@media(max-height:620px)]:pt-2 [@media(max-height:620px)]:pb-20">
      <header className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 [@media(max-height:620px)]:gap-y-1">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="glass grid size-9 place-items-center rounded-full text-accent-text sm:size-10"
          >
            <TimerIcon className="size-[18px]" />
          </span>
          <div>
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">
              PomodoroFlow
            </h1>
            <p className="hidden text-xs text-muted sm:block [@media(max-height:620px)]:hidden">
              Breathe. Focus. Repeat.
            </p>
          </div>
        </div>

        <ModeTabs
          selected={mode}
          onChange={handleModeChange}
          className="order-3 w-full lg:absolute lg:top-1/2 lg:left-1/2 lg:order-none lg:w-auto lg:-translate-x-1/2 lg:-translate-y-1/2"
        />

        <div className="glass flex items-center gap-0.5 rounded-full p-1">
          <ThemeToggle />
          <IconButton
            label="Open settings"
            onClick={() => openSurface("settings")}
          >
            <GearIcon className="size-[18px]" />
          </IconButton>
          <IconButton label="Open tasks" onClick={() => openSurface("tasks")}>
            <ChecklistIcon className="size-[18px]" />
          </IconButton>
        </div>
      </header>

      {storageUnavailable ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl border border-accent-text/40 bg-accent/10 px-3.5 py-3 text-xs leading-relaxed text-foreground"
        >
          <AlertIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-accent-text"
          />
          <span>
            Browser storage is unavailable, so tasks, streaks and session history
            cannot be saved. PomodoroFlow keeps working for this visit only.
          </span>
        </p>
      ) : null}

      <main className="relative flex flex-1 items-center justify-center py-8 [@media(max-height:620px)]:py-2">
        <NavRail
          active={activeSurface}
          onSelect={openSurface}
          className="absolute top-1/2 left-0 hidden -translate-y-1/2 lg:flex"
        />

        <div
          id="timer-stage"
          role="tabpanel"
          aria-labelledby={`mode-tab-${mode}`}
          className="flex flex-col items-center gap-7 outline-none sm:gap-9 [@media(max-height:620px)]:gap-3"
        >
          <TimerRing
            remainingMs={remainingMs}
            totalMs={totalMs}
            sessionLabel={meta.sessionLabel}
            running={isRunning}
          />

          {activeTask ? (
            <div className="flex max-w-[22rem] items-center gap-2 rounded-full border border-accent-text/45 bg-accent/10 py-1.5 pr-2 pl-3 text-xs">
              <ChecklistIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-accent-text"
              />
              <span className="min-w-0 truncate">
                <span className="text-muted">Focus task: </span>
                <span className="font-medium text-foreground">
                  {activeTask.title}
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleSelectActiveTask(null)}
                aria-label={`Clear focus task ${activeTask.title}`}
                className="grid size-6 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <CloseIcon className="size-3.5" />
              </button>
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={toggle}
              className="btn-primary h-14 min-w-[12.5rem] px-9 text-base sm:h-16 sm:min-w-[14.5rem] sm:text-lg [@media(max-height:620px)]:h-11 [@media(max-height:620px)]:min-w-[10.5rem]"
            >
              {isRunning ? (
                <PauseIcon className="size-5" />
              ) : (
                <PlayIcon className="size-5" />
              )}
              {startLabel}
            </button>

            <div className="flex min-h-9 flex-col items-center gap-1 [@media(max-height:620px)]:min-h-0">
              {status === "completed" ? (
                <p className="flex max-w-[22rem] flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-1 text-center text-sm font-medium text-foreground">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-accent-strong"
                  />
                  {meta.label} complete
                  <span className="text-muted">
                    Next up: {MODE_META[nextModeAfter(mode)].label}
                  </span>
                </p>
              ) : null}

              {status !== "idle" ? (
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
                >
                  <ResetIcon className="size-3.5" />
                  Reset timer
                </button>
              ) : null}
            </div>
          </div>

          {/* F011: dashboard-level daily totals, derived from session history. */}
          {showTodayStats ? (
            <section
              aria-label="Today's focus statistics"
              className="max-w-[22rem] rounded-2xl border border-glass-border bg-foreground/5 px-4 py-2 text-center"
            >
              {todaySummary.sessions === 0 ? (
                <p className="text-xs leading-relaxed text-muted">
                  No focus sessions yet today. Finish one to start your daily
                  totals.
                </p>
              ) : (
                <dl className="flex items-center justify-center gap-x-3 gap-y-1 text-xs">
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-muted">Sessions today</dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {todaySummary.sessions}
                    </dd>
                  </div>
                  <span aria-hidden="true" className="text-foreground/25">
                    ·
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-muted">Focus time</dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {formatFocusDuration(todaySummary.totalMs)}
                    </dd>
                  </div>
                </dl>
              )}
            </section>
          ) : null}
        </div>
      </main>

      <div className="pointer-events-none absolute inset-x-8 bottom-7 hidden items-end justify-between lg:flex">
        <PillButton
          label="Music"
          icon={MusicIcon}
          onClick={() => openSurface("music")}
          playing={audio.playing}
        />
        <div className="pointer-events-auto flex items-center gap-2.5">
          <PillButton
            label="Tasks"
            icon={ChecklistIcon}
            onClick={() => openSurface("tasks")}
          />
          <PillButton
            label="Settings"
            icon={GearIcon}
            onClick={() => openSurface("settings")}
          />
        </div>
      </div>

      <BottomNav active={activeSurface} onSelect={openSurface} />

      <SettingsSheet
        open={surface === "settings"}
        durations={durations}
        onClose={closeSurface}
        onSave={handleSaveDurations}
        headerExtra={
          <TimerStatusPill
            mode={mode}
            status={status}
            remainingMs={remainingMs}
          />
        }
      />

      <TasksSheet
        open={surface === "tasks"}
        onClose={closeSurface}
        tasks={tasks}
        ready={ready}
        storageAvailable={storageAvailable}
        activeTaskId={activeTaskId}
        onSelectActiveTask={handleSelectActiveTask}
        onCreate={createTask}
        onUpdate={updateTask}
        onDelete={handleDeleteTask}
        headerExtra={
          <TimerStatusPill
            mode={mode}
            status={status}
            remainingMs={remainingMs}
          />
        }
      />

      <MusicSheet
        open={surface === "music"}
        onClose={closeSurface}
        player={audio}
        headerExtra={
          <TimerStatusPill
            mode={mode}
            status={status}
            remainingMs={remainingMs}
          />
        }
      />

      <InsightsSheet
        open={surface === "insights"}
        onClose={closeSurface}
        sessions={sessions}
        ready={sessionsReady}
        storageAvailable={sessionsStorageAvailable}
        headerExtra={
          <TimerStatusPill
            mode={mode}
            status={status}
            remainingMs={remainingMs}
          />
        }
      />

      <StreakSheet
        open={surface === "streak"}
        onClose={closeSurface}
        sessions={sessions}
        ready={sessionsReady}
        storageAvailable={sessionsStorageAvailable}
        headerExtra={
          <TimerStatusPill
            mode={mode}
            status={status}
            remainingMs={remainingMs}
          />
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

interface PillButtonProps {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  onClick: () => void;
  /** Highlights the icon and adds a playback indicator (F023). */
  playing?: boolean;
}

function PillButton({ label, icon: Icon, onClick, playing }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium text-foreground/90 transition-colors",
        "hover:bg-foreground/10 hover:text-foreground",
      )}
    >
      <Icon
        className={cn("size-[18px]", playing ? "text-accent-text" : "text-muted")}
      />
      {label}
      {playing ? (
        <span aria-hidden="true" className="equalizer">
          <span />
          <span />
          <span />
        </span>
      ) : null}
    </button>
  );
}
