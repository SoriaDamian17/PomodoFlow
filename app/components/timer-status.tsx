import { cn } from "@/app/lib/cn";
import type { TimerStatus } from "@/app/lib/countdown-core";
import { MODE_META, formatClock, type TimerMode } from "@/app/lib/timer";

interface TimerStatusPillProps {
  mode: TimerMode;
  status: TimerStatus;
  remainingMs: number;
  className?: string;
}

/**
 * Read-only mirror of the timer shown inside an open sheet (F022).
 *
 * The countdown lives in the dashboard, not in the sheet, so it keeps running
 * while a panel is open; this pill makes that visible without turning into a
 * chatty live region (the dashboard already owns announcements).
 */
export function TimerStatusPill({
  mode,
  status,
  remainingMs,
  className,
}: TimerStatusPillProps) {
  const isRunning = status === "running";
  const statusLabel =
    status === "running"
      ? "Running"
      : status === "paused"
        ? "Paused"
        : status === "completed"
          ? "Complete"
          : "Ready";

  return (
    <p
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-glass-border bg-foreground/5 px-3 py-1.5 text-xs text-muted",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          isRunning
            ? "animate-pulse bg-accent-strong motion-reduce:animate-none"
            : status === "paused"
              ? "bg-accent-strong/70"
              : "bg-foreground/30",
        )}
      />
      <span className="font-medium text-foreground">{MODE_META[mode].label}</span>
      <span aria-hidden="true" className="text-foreground/25">
        ·
      </span>
      <span className="font-medium tabular-nums text-foreground">
        {formatClock(remainingMs)}
      </span>
      <span>{statusLabel}</span>
    </p>
  );
}
