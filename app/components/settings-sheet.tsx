"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/app/lib/cn";
import {
  DEFAULT_DURATIONS,
  DURATION_LIMITS,
  validateDurations,
  type Durations,
} from "@/app/lib/settings";
import { MODE_META, TIMER_MODES, type TimerMode } from "@/app/lib/timer";
import { Sheet } from "@/app/components/sheet";

interface SettingsSheetProps {
  open: boolean;
  durations: Durations;
  onClose: () => void;
  onSave: (durations: Durations) => void;
  /** Optional context rendered in the sheet header (F022 timer indicator). */
  headerExtra?: ReactNode;
}

type DurationFormValues = Record<TimerMode, string>;

function toFormValues(durations: Durations): DurationFormValues {
  return {
    focus: String(durations.focus),
    short: String(durations.short),
    long: String(durations.long),
  };
}

/** Timer duration settings with inline validation (F003). */
export function SettingsSheet({
  open,
  durations,
  onClose,
  onSave,
  headerExtra,
}: SettingsSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Timer settings"
      description="Tune how long each session lasts. Durations apply in minutes."
      headerExtra={headerExtra}
    >
      {/* Mounting the form only while open gives every visit fresh values
          without a setState-in-effect reset. */}
      {open ? (
        <DurationForm
          durations={durations}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Sheet>
  );
}

interface DurationFormProps {
  durations: Durations;
  onClose: () => void;
  onSave: (durations: Durations) => void;
}

function DurationForm({ durations, onClose, onSave }: DurationFormProps) {
  const [values, setValues] = useState<DurationFormValues>(() =>
    toFormValues(durations),
  );
  const [errors, setErrors] = useState<Partial<Record<TimerMode, string>>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = validateDurations(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    onSave(result.durations);
    onClose();
  }

  function handleRestoreDefaults() {
    setValues(toFormValues(DEFAULT_DURATIONS));
    setErrors({});
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-full flex-col gap-6">
      <div className="flex flex-col gap-5">
        {TIMER_MODES.map((mode) => {
          const limits = DURATION_LIMITS[mode];
          const error = errors[mode];
          const inputId = `duration-${mode}`;
          const hintId = `${inputId}-hint`;
          const errorId = `${inputId}-error`;

          return (
            <div key={mode}>
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={inputId}
                  className="text-sm font-medium text-foreground"
                >
                  {MODE_META[mode].label}
                </label>
                <span className="text-[11px] text-muted">
                  {limits.min}–{limits.max} min
                </span>
              </div>

              <div className="relative mt-2">
                <input
                  id={inputId}
                  name={mode}
                  type="number"
                  inputMode="numeric"
                  min={limits.min}
                  max={limits.max}
                  step={1}
                  required
                  autoComplete="off"
                  value={values[mode]}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : hintId}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [mode]: event.target.value,
                    }))
                  }
                  className={cn(
                    "h-12 w-full rounded-2xl border bg-foreground/5 pr-14 pl-4 text-right text-lg font-medium tabular-nums text-foreground transition-colors outline-none",
                    error
                      ? "border-accent-text/70"
                      : "border-glass-border focus-visible:border-accent-strong",
                  )}
                />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-muted">
                  min
                </span>
              </div>

              {error ? (
                <p id={errorId} role="alert" className="mt-1.5 text-xs text-accent-text">
                  {error}
                </p>
              ) : (
                <p id={hintId} className="mt-1.5 text-xs text-muted">
                  Whole minutes, {limits.min} to {limits.max}.
                </p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleRestoreDefaults}
          className="self-start rounded-full text-xs font-medium text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Restore defaults
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button type="submit" className="btn-primary h-12 w-full text-sm">
          Save settings
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-full rounded-full text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
