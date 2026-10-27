import { describeClock, formatClock } from "@/app/lib/timer";

interface TimerRingProps {
  remainingMs: number;
  totalMs: number;
  sessionLabel: string;
  running: boolean;
}

const RADIUS = 150;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Visual gap at the head of the arc, mirroring the draft's notch. */
const HEAD_GAP = 6;

/** Radial timer with a coral progress arc and a head dot (F018). */
export function TimerRing({
  remainingMs,
  totalMs,
  sessionLabel,
  running,
}: TimerRingProps) {
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const arcLength = Math.max(0, fraction * CIRCUMFERENCE - HEAD_GAP);
  const dashOffset = CIRCUMFERENCE - arcLength;
  const headAngle = fraction * 360;
  const clock = formatClock(remainingMs);

  return (
    <div
      role="progressbar"
      aria-label={`${sessionLabel} timer`}
      aria-valuemin={0}
      aria-valuemax={Math.round(totalMs / 1000)}
      aria-valuenow={Math.round(remainingMs / 1000)}
      aria-valuetext={describeClock(remainingMs)}
      className="timer-stage-ring relative grid aspect-square place-items-center"
    >
      <div aria-hidden="true" className="timer-halo absolute inset-0 rounded-full" />

      <svg
        aria-hidden="true"
        viewBox="0 0 320 320"
        className="absolute inset-0 size-full"
      >
        <circle
          cx="160"
          cy="160"
          r={RADIUS}
          fill="none"
          strokeWidth={running ? 7 : 6}
          className="stroke-ring-track transition-[stroke-width] duration-500"
        />
        <circle
          cx="160"
          cy="160"
          r={RADIUS}
          fill="none"
          strokeWidth={running ? 7 : 6}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 160 160)"
          className="ring-progress stroke-accent-strong transition-[stroke-width] duration-500"
        />
        {fraction > 0 && (
          <g transform={`rotate(${headAngle} 160 160)`}>
            <circle cx="160" cy={160 - RADIUS} r="5.5" className="fill-accent-strong" />
          </g>
        )}
      </svg>

      <div className="relative z-10 flex flex-col items-center gap-3 sm:gap-4">
        <span className="timer-digits text-[clamp(2.25rem,9.5vmin,5.5rem)] leading-none font-semibold text-foreground">
          {clock}
        </span>
        <span className="timer-pill glass flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-medium tracking-wide text-foreground/90 sm:text-xs">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-strong" />
          {sessionLabel}
        </span>
      </div>
    </div>
  );
}
