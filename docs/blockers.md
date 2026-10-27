# Blocked acceptance steps

Features are left at `passes: false` in `docs/feature_list.json` when at least one
listed step cannot be verified yet. This file records why, outside the backlog.

## P4 (F023, F031, F033) and F012 have no remaining blockers

P4 shipped with a production-build verification run in headless Chrome against
`npm run build && npm start` (43/43 checks) plus a separate development run for
the service-worker split. Evidence is summarized below; `docs/audio.md`
documents the generated audio assets.

### Verification notes (automated substitutes)

Two F031 steps cannot be executed literally by a headless test, so they were
verified with the closest authoritative equivalent:

- **F031 step 4 — "Lighthouse installability checks pass".** Current Lighthouse
  releases removed the PWA category, so installability was read from Chrome
  itself: CDP `Page.getAppManifest` returned no errors and
  `Page.getInstallabilityErrors` returned an empty list on the production build.
  Those are the same checks Lighthouse used to aggregate.
- **F031 step 5 — "the installed app launches standalone and offline after one
  visit".** Installing a PWA is a browser UI flow that headless Chrome cannot
  drive. Verified instead: `display: "standalone"`, `start_url`/`scope` `/`,
  manifest icons resolving to 200 PNGs, installability errors empty, and a
  controlled reload with the network offline rendering the full timer shell from
  the precached HTML/chunks. A manual "Install app" check on a desktop and an
  Android device is still worth doing before release.

Everything else was executed directly:

- **F023** — Music pill opens the sheet; play/pause, previous/next, three-track
  list and volume slider; zero audio requests before Play (no autoplay); track
  change and volume persisted through reload with playback still paused; audio
  kept playing across sheet switches and through a complete focus session; mute
  toggle with `aria-pressed`; track change/transport driven from the keyboard;
  offline playback from the precache; clear error when a track is evicted from
  the cache while offline.
- **F031** — manifest fields (`#fd8464` theme, `#0b0f1a` background,
  standalone, start_url), 192/512 + maskable icons and apple-touch-icon served
  as real PNGs with no 404s, theme-color/apple meta tags, installability errors
  empty, `/sw.js` registered in production at scope `/`, and **no**
  registration, cache or `sw.js` request in `next dev` (Turbopack, Serwist
  disabled by `disable: process.env.NODE_ENV === "development"`).
- **F033** — offline reload of the shell after one visit, ambient scene
  rendered offline, offline banner non-blocking (`pointer-events: none`), task
  writes and session/settings reads working offline, timer running offline, all
  `<script>` URLs of the served HTML present in the precache (no stale build),
  ambient tracks served offline, reconnect not forcing a reload
  (`reloadOnOnline: false`), and a byte-level `public/sw.js` change producing a
  "new version is ready" prompt that only reloads after the user presses
  Reload (marker survived until then; new worker active afterwards).
- **F012** — task + focus-task selection, durations, selected track/volume and
  the completed focus session all restored after refresh; malformed
  `localStorage`/IndexedDB rows fall back to defaults; schema v2→v3 upgrade
  keeps existing todos; unavailable IndexedDB shows the explained fallback; an
  in-progress timer restores from its stored target.

### Fixed during verification

`useCountdown` hydrated stored durations after mount, and the resulting
duration-change effect used to clear the timer snapshot before the dashboard
could restore it. With non-default durations this made F012 step 6 fail. The
effect now re-reads a stored snapshot that matches the newly hydrated length and
only starts fresh (and clears the snapshot) when the length really changed.

## Still blocked outside this phase

- **F017 — wallpaper asset.** The shell still uses the CSS/SVG ambient scene in
  `app/components/ambient-background.tsx`; the draft's full-bleed artwork and
  the `next/image` step are unimplemented, so F017 stays `false`. F033's
  "wallpaper renders offline" step was verified against that scene.
- **F027 — timer accuracy.** Partially verified (in-progress restore is covered
  by F012 above), but background-tab/sleep accuracy and the mocked-clock test
  are still open, so it stays `false`.

## Generated artifacts

`public/sw.js` and `public/swe-worker-*.js` are build outputs. They are
tracked in this repository but must not be committed from feature work; run
`git checkout -- public/sw.js` after a verification build if they show as
modified.
