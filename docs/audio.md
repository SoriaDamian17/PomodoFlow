# Ambient audio (F023/F033)

The Music surface ships three ambient loops. They are **synthesized in this
repository** rather than downloaded: no third-party samples, no license file to
track, and no dependency on an external CDN. The generator is deterministic, so
re-running it reproduces byte-identical files.

## Tracks

| id                 | Title             | Character                        |
| ------------------ | ----------------- | -------------------------------- |
| `rain-on-the-pond` | Rain on the pond  | Soft rain over still water       |
| `forest-at-dusk`   | Forest at dusk    | Low warm pads, distant leaves    |
| `night-waves`      | Night waves       | Slow swells under a quiet sky    |

Each file is a 24-second mono MP3 (22 050 Hz, 64 kbps, ~188 kB) that loops from
`public/audio/<id>.mp3`. Files are served by Next.js and precached by the
service worker, so all three are playable offline right after the first visit.

## Regenerating

```bash
npm run assets:audio   # node scripts/generate-audio.mjs
```

`scripts/generate-audio.mjs` builds the waveform sample by sample:

- Every partial is an integer multiple of `1/24 Hz`, so each track repeats
  sample-perfectly at the loop point (no click, no crossfade needed).
- Noise-like washes are dense banks of periodic partials with a `1/f` tilt;
  drones get slow tremolo; rain adds sparse decaying droplets.
- Output is normalized with `tanh` soft clipping to avoid hard clipping.
- Encoding uses [`@breezystack/lamejs`](https://github.com/shijinyu/lamejs)
  (LGPL, pure JavaScript MP3 encoder), a **devDependency**: it is only needed
  to regenerate assets, never shipped to the browser.

The icon set is generated the same way by `npm run assets:icons`
(`scripts/generate-icons.mjs`, dependency-free PNG encoder).

## Runtime design

- `app/lib/audio.ts` — track catalog, `AudioSettings` (`trackId`, `volume`,
  `muted`), defensive `parseAudioSettings`, `clampVolume`.
- `app/lib/use-audio-settings.ts` — `useSyncExternalStore` over
  `localStorage["pomodoroflow:audio"]`, so server render and hydration both see
  defaults and the stored values swap in without a `setState`-in-effect.
- `app/lib/audio-element.ts` — one detached `HTMLAudioElement` for the whole
  app (`loop`, `preload="none"`). A module singleton instead of a React ref
  keeps playback alive across sheet switches and satisfies the React Compiler
  lint rules (`react-hooks/refs`, `react-hooks/immutability`).
- `app/lib/use-audio-player.ts` — transport state derived from the element's
  own `play`/`pause`/`error` events. Track changes during playback resume the
  new source; the listener effect is bound once so it never pauses the element
  mid-switch.
- `app/components/music-sheet.tsx` — the player UI: transport, volume slider,
  mute, track list with `aria-pressed`, offline note and error alert.

Behaviour guarantees:

- **No autoplay.** `play()` is only called from a user press, and nothing about
  playback is persisted. A reload restores only track, volume and mute state.
- **Timer-independent.** Playing, pausing or switching sheets never touches the
  countdown, and the timer never starts or stops the audio.
- **Offline.** All three loops are in the service worker precache; if a track
  cannot be fetched (cache cleared while offline), the sheet shows
  "… is not available offline yet. Reconnect once to save it." instead of
  failing silently.

## Tests

`app/lib/audio.test.ts` covers the persisted-settings parser (per-field
fallbacks, clamping, malformed JSON) and the catalog helpers. Run the suite with
`npm test`; assets themselves are checked by the manual/production checklist in
`docs/blockers.md` (precache contents, offline playback).
