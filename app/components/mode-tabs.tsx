"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/app/lib/cn";
import { MODE_META, TIMER_MODES, type TimerMode } from "@/app/lib/timer";

interface ModeTabsProps {
  selected: TimerMode;
  onChange: (mode: TimerMode) => void;
  className?: string;
}

/** Mode switcher matching the draft: coral dot, label and active underline. */
export function ModeTabs({ selected, onChange, className }: ModeTabsProps) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = TIMER_MODES.length - 1;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
    else if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = lastIndex;

    if (nextIndex === null) return;

    event.preventDefault();
    onChange(TIMER_MODES[nextIndex]);
    tabsRef.current[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Timer mode"
      className={cn("flex items-center justify-center gap-1 sm:gap-2", className)}
    >
      {TIMER_MODES.map((mode, index) => {
        const isActive = mode === selected;

        return (
          <button
            key={mode}
            ref={(node) => {
              tabsRef.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`mode-tab-${mode}`}
            aria-selected={isActive}
            aria-controls="timer-stage"
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(mode)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors sm:px-4 sm:text-sm",
              isActive ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full transition-colors",
                isActive ? "bg-accent-strong" : "bg-foreground/35",
              )}
            />
            {MODE_META[mode].label}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-accent-strong transition-opacity sm:inset-x-4",
                isActive ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
