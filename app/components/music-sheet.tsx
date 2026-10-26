"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/app/lib/cn";
import { AUDIO_TRACKS } from "@/app/lib/audio";
import type { AudioPlayer } from "@/app/lib/use-audio-player";
import { IconButton } from "@/app/components/icon-button";
import {
  AlertIcon,
  MusicIcon,
  NextIcon,
  OfflineIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from "@/app/components/icons";
import { Sheet } from "@/app/components/sheet";

interface MusicSheetProps {
  open: boolean;
  onClose: () => void;
  player: AudioPlayer;
  /** Optional context rendered in the sheet header (F022 timer indicator). */
  headerExtra?: ReactNode;
}

/**
 * Ambient player (F023).
 *
 * The sheet only renders controls: the <audio> element itself lives in the
 * dashboard, so closing the sheet or opening Settings never interrupts
 * playback. Audio starts exclusively from the Play button (no autoplay), and
 * every control is a native button or range input for keyboard support.
 */
export function MusicSheet({
  open,
  onClose,
  player,
  headerExtra,
}: MusicSheetProps) {
  const volumeId = useId();
  const percent = Math.round(player.volume * 100);
  const isCurrent = (id: string) => id === player.track.id;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Music"
      description="Ambient sound for deep work. It keeps playing while the timer runs."
      headerExtra={headerExtra}
    >
      <div className="flex flex-col gap-5">
        {player.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-accent-text/40 bg-accent/10 px-3.5 py-3 text-xs leading-relaxed text-foreground"
          >
            <AlertIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-accent-text"
            />
            <span>{player.error}</span>
          </p>
        ) : null}

        <section
          aria-label="Now playing"
          className="rounded-3xl border border-glass-border bg-foreground/5 p-4"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent-text"
            >
              <MusicIcon className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {player.track.title}
              </p>
              <p className="truncate text-xs text-muted">
                {player.track.description}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted">
                {player.playing ? (
                  <>
                    <span aria-hidden="true" className="equalizer">
                      <span />
                      <span />
                      <span />
                    </span>
                    Playing
                  </>
                ) : (
                  "Paused"
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3">
            <IconButton
              label="Previous track"
              onClick={player.previous}
              className="size-11"
            >
              <PreviousIcon className="size-4.5" />
            </IconButton>

            <button
              type="button"
              onClick={player.toggle}
              aria-pressed={player.playing}
              aria-label={
                player.playing
                  ? `Pause ${player.track.title}`
                  : `Play ${player.track.title}`
              }
              className="btn-primary size-14 shrink-0 rounded-full"
            >
              {player.playing ? (
                <PauseIcon className="size-5" />
              ) : (
                <PlayIcon className="size-5" />
              )}
            </button>

            <IconButton
              label="Next track"
              onClick={player.next}
              className="size-11"
            >
              <NextIcon className="size-4.5" />
            </IconButton>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <IconButton
              label={player.muted ? "Unmute ambience" : "Mute ambience"}
              aria-pressed={player.muted}
              onClick={player.toggleMute}
              className="size-10"
            >
              {player.muted ? (
                <VolumeMuteIcon className="size-[18px]" />
              ) : (
                <VolumeIcon className="size-[18px]" />
              )}
            </IconButton>

            <label htmlFor={volumeId} className="sr-only">
              Ambient volume
            </label>
            <input
              id={volumeId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={percent}
              aria-valuetext={`${percent} percent`}
              onChange={(event) =>
                player.setVolume(Number(event.target.value) / 100)
              }
              className="h-11 w-full cursor-pointer [accent-color:var(--accent-strong)]"
            />
            <output
              htmlFor={volumeId}
              className="w-9 shrink-0 text-right text-xs tabular-nums text-muted"
            >
              {percent}%
            </output>
          </div>
        </section>

        <section aria-labelledby="music-tracks-heading">
          <h3
            id="music-tracks-heading"
            className="text-xs font-semibold tracking-wide text-muted uppercase"
          >
            Tracks
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {AUDIO_TRACKS.map((track) => {
              const current = isCurrent(track.id);

              return (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() => player.selectTrack(track.id)}
                    aria-pressed={current}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                      current
                        ? "border-accent-text/50 bg-accent/10"
                        : "border-glass-border bg-foreground/5 hover:bg-foreground/10",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full",
                        current
                          ? "bg-accent/20 text-accent-text"
                          : "bg-foreground/10 text-muted",
                      )}
                    >
                      <MusicIcon className="size-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {track.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {track.description}
                      </span>
                    </span>

                    {current ? (
                      <span className="shrink-0 text-[11px] font-medium text-accent-text">
                        {player.playing ? "Playing" : "Selected"}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
          <OfflineIcon
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-muted"
          />
          <span>
            Tracks are saved for offline listening after your first visit. The
            selected track, volume and mute state are remembered on this device.
          </span>
        </p>

        <p role="status" aria-live="polite" className="sr-only">
          {player.playing
            ? `Playing ${player.track.title}`
            : `Ambience paused. ${player.track.title} selected.`}
        </p>
      </div>
    </Sheet>
  );
}
