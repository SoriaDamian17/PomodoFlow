/**
 * Single ambient <audio> instance for the whole app (F023).
 *
 * The player is intentionally detached from React: it is created once on the
 * client and never re-created, so playback survives opening and closing the
 * Music sheet and any future client-side navigation. A module singleton also
 * avoids exposing a ref from a hook, which keeps the React Compiler's ref and
 * immutability checks happy without disabling them.
 */

let audioElement: HTMLAudioElement | null = null;

export function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;

  if (!audioElement) {
    audioElement = new Audio();
    audioElement.loop = true;
    audioElement.preload = "none";
  }

  return audioElement;
}
