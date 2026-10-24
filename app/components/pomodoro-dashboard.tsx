"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/app/lib/cn";
import { writeStoredDurations, type Durations } from "@/app/lib/settings";
import type { Surface } from "@/app/lib/surfaces";
import { MODE_META, minutesToMs, type TimerMode } from "@/app/lib/timer";
import { useCountdown } from "@/app/lib/use-countdown";
import { useDurations } from "@/app/lib/use-durations";
import { BottomNav } from "@/app/components/bottom-nav";
import { ModeTabs } from "@/app/components/mode-tabs";
import { NavRail } from "@/app/components/nav-rail";
import { SettingsSheet } from "@/app/components/settings-sheet";
import { Sheet } from "@/app/components/sheet";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { TimerRing } from "@/app/components/timer-ring";
import { IconButton } from "@/app/components/icon-button";
import {
  ChecklistIcon,
  GearIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  TimerIcon,
} from "@/app/components/icons";
import type { ComponentType, SVGProps } from "react";

const COMING_SOON: Partial<Record<Surface, { title: string; description: string; message: string }>> = {
  tasks: {
    title: "Tasks",
    description: "Plan what this focus session is for.",
    message:
      "Task capture, priorities and filters land in the next update. For now, start a session with your intention in mind.",
  },
  music: {
    title: "Music",
    description: "Ambient sound for deep work.",
    message:
      "Soundscapes are being prepared. The player will live in this panel and keep playing across sessions.",
  },
  streak: {
    title: "Streak",
    description: "Keep the flame alive.",
    message:
      "Streaks arrive once completed focus sessions are stored. Finish a session to light the flame.",
  },
  insights: {
    title: "Focus insights",
    description: "How your week is shaping up.",
    message:
      "Daily totals and weekly focus minutes appear here once sessions are being recorded.",
  },
};

export function PomodoroDashboard() {
  const [mode, setMode] = useState<TimerMode>("focus");
  const durations = useDurations();
  const [surface, setSurface] = useState<Surface | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const totalMs = minutesToMs(durations[mode]);
  const { remainingMs, status, toggle, reset } = useCountdown(totalMs);
  const isRunning = status === "running";
  const meta = MODE_META[mode];
  const activeSurface: Surface = surface ?? "timer";

  const previousStatusRef = useRef(status);
  useEffect(() => {
    if (status === "completed" && previousStatusRef.current !== "completed") {
      setAnnouncement(`${meta.label} session complete.`);
    }
    previousStatusRef.current = status;
  }, [status, meta.label]);

  function handleModeChange(nextMode: TimerMode) {
    if (nextMode === mode) return;

    // Documented rule: switching modes stops the current session instead of
    // silently carrying its length into the new mode.
    if (status === "running" || status === "paused") reset();

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

            <div className="flex min-h-9 items-center [@media(max-height:620px)]:min-h-0">
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
        </div>
      </main>

      <div className="pointer-events-none absolute inset-x-8 bottom-7 hidden items-end justify-between lg:flex">
        <PillButton
          label="Music"
          icon={MusicIcon}
          onClick={() => openSurface("music")}
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
      />

      <Sheet
        open={surface === "tasks"}
        onClose={closeSurface}
        title="Tasks"
        description="Plan what this focus session is for."
      >
        <ComingSoon message={COMING_SOON.tasks?.message ?? ""} />
      </Sheet>

      <Sheet
        open={surface === "music"}
        onClose={closeSurface}
        title="Music"
        description="Ambient sound for deep work."
      >
        <ComingSoon message={COMING_SOON.music?.message ?? ""} />
      </Sheet>

      <Sheet
        open={surface === "streak"}
        onClose={closeSurface}
        title="Streak"
        description="Keep the flame alive."
      >
        <ComingSoon message={COMING_SOON.streak?.message ?? ""} />
      </Sheet>

      <Sheet
        open={surface === "insights"}
        onClose={closeSurface}
        title="Focus insights"
        description="How your week is shaping up."
      >
        <ComingSoon message={COMING_SOON.insights?.message ?? ""} />
      </Sheet>

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
}

function PillButton({ label, icon: Icon, onClick }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium text-foreground/90 transition-colors",
        "hover:bg-foreground/10 hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] text-muted" />
      {label}
    </button>
  );
}

function ComingSoon({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-glass-border px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-full bg-accent/15 text-accent-text"
      >
        <TimerIcon className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">Coming soon</p>
      <p className="max-w-xs text-sm leading-relaxed text-muted">{message}</p>
    </div>
  );
}
