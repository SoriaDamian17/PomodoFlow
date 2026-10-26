"use client";

import { useEffect, useRef, useState } from "react";
import { getAudioElement } from "@/app/lib/audio-element";
import {
  AUDIO_TRACKS,
  clampVolume,
  getAudioTrack,
  isAudioTrackId,
  writeStoredAudioSettings,
  type AudioTrack,
} from "@/app/lib/audio";
import { useAudioSettings } from "@/app/lib/use-audio-settings";

export interface AudioPlayer {
  track: AudioTrack;
  playing: boolean;
  volume: number;
  muted: boolean;
  error: string | null;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  selectTrack: (id: string) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
}

/**
 * Player-facing reason when a source cannot be played (F023 step 6). Kept
 * outside the hook so the element listeners can stay bound once.
 */
function describeFailure(title: string): string {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return offline
    ? `${title} is not available offline yet. Reconnect once to save it.`
    : `${title} could not be played. Check your connection and try again.`;
}

/**
 * Ambient player state for the Music surface (F023).
 *
 * Playback lives in a detached singleton (app/lib/audio-element.ts), so opening
 * another sheet or letting the timer run never interrupts the music. A reload
 * only restores the selected track, volume and mute state and never autoplays:
 * `play()` is only ever called from a click.
 */
export function useAudioPlayer(): AudioPlayer {
  const settings = useAudioSettings();
  const track = getAudioTrack(settings.trackId);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow the persisted track (including the hydration swap from defaults to
  // the stored value) without reloading a source that is already set.
  useEffect(() => {
    const audio = getAudioElement();
    if (!audio) return;
    if (audio.getAttribute("src") === track.src) return;
    audio.src = track.src;
  }, [track.src]);

  useEffect(() => {
    const audio = getAudioElement();
    if (!audio) return;
    audio.volume = clampVolume(settings.volume);
    audio.muted = settings.muted;
  }, [settings.volume, settings.muted]);

  // Detect transport changes from the element itself, so "playing" stays true
  // only while the browser is actually playing something. This effect is bound
  // once: `describeFailure` reads the current title from a ref, because
  // re-binding on every track change would pause the element mid-switch.
  const titleRef = useRef(track.title);
  useEffect(() => {
    titleRef.current = track.title;
  }, [track.title]);

  useEffect(() => {
    const audio = getAudioElement();
    if (!audio) return;

    const onPlay = () => {
      setPlaying(true);
      setError(null);
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      setError(describeFailure(titleRef.current));
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // Leaving the dashboard entirely stops the ambience; switching panels or
  // tracks must not (F023).
  useEffect(() => () => getAudioElement()?.pause(), []);

  function play() {
    const audio = getAudioElement();
    if (!audio) return;

    setError(null);
    void audio.play().catch(() => setError(describeFailure(track.title)));
  }

  function pause() {
    getAudioElement()?.pause();
  }

  function toggle() {
    if (playing) pause();
    else play();
  }

  function selectTrack(id: string) {
    if (!isAudioTrackId(id) || id === settings.trackId) return;

    const nextTrack = getAudioTrack(id);
    const wasPlaying = playing;

    setError(null);
    writeStoredAudioSettings({ ...settings, trackId: id });

    const audio = getAudioElement();
    if (!audio) return;

    // Swap the source immediately so a running track keeps its momentum; the
    // sync effect above then sees the matching attribute and does nothing.
    audio.src = nextTrack.src;

    if (wasPlaying) {
      void audio.play().catch(() => setError(describeFailure(nextTrack.title)));
    }
  }

  function step(delta: 1 | -1) {
    const index = AUDIO_TRACKS.findIndex((item) => item.id === track.id);
    const nextIndex = (index + delta + AUDIO_TRACKS.length) % AUDIO_TRACKS.length;
    selectTrack(AUDIO_TRACKS[nextIndex].id);
  }

  function setVolume(value: number) {
    // Moving the slider is an explicit request to hear the track.
    writeStoredAudioSettings({
      ...settings,
      volume: clampVolume(value),
      muted: false,
    });
  }

  function toggleMute() {
    writeStoredAudioSettings({ ...settings, muted: !settings.muted });
  }

  return {
    track,
    playing,
    volume: settings.volume,
    muted: settings.muted,
    error,
    toggle,
    next: () => step(1),
    previous: () => step(-1),
    selectTrack,
    setVolume,
    toggleMute,
  };
}
