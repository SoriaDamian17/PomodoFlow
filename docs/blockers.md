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

### Fixed during verification (P4)

`useCountdown` hydrated stored durations after mount, and the resulting
duration-change effect used to clear the timer snapshot before the dashboard
could restore it. With non-default durations this made F012 step 6 fail. The
effect now re-reads a stored snapshot that matches the newly hydrated length and
only starts fresh (and clears the snapshot) when the length really changed.

## P5 (F013, F014, F032, F034, F015) has no remaining blockers

P5 shipped with a headless-Chrome verification run against
`npm run build && npm start` (120/120 checks across 8 viewports: 390x844,
768x1024, 1024x768, 1280x800, 1440x900, 320px, 200% zoom and 844x390
landscape), plus `npm test` (92 tests, 8 files) and a `next dev` smoke test.

### Verification notes (automated substitutes)

Two acceptance steps cannot be executed literally by a headless run, so they
were verified with the closest authoritative equivalent:

- **F032 step 3 — "no animation causes layout shift (CLS near zero)".** CLS was
  measured directly with a buffered `layout-shift` `PerformanceObserver` in
  Chrome for 3s after load: **0.032**, under the 0.05 "essentially zero" bar.
- **F034 step 2 — "targets at least 44x44 CSS px on touch".** Instead of
  emulating a device, the 44px minimum is enforced in CSS for every
  `button`/`select` (unconditional, `--touch-target`), and the harness asserts
  the real `getBoundingClientRect()` of every visible control at all 8
  viewports — a stricter check than one touch device.

Everything else was executed directly:

- **F014** — `npm test` runs the full Vitest suite: countdown transitions with
  a mocked clock, duration validation, task validation/update (in-memory idb
  stand-in), session aggregation and daily/weekly statistics, audio-settings
  parsing, and the IndexedDB `upgrade()` path incl. malformed/unavailable
  storage recovery.
- **F013** — tab order equals visual order at every viewport; every input and
  icon-only button exposes an accessible name; keyboard focus renders the
  global 2px outline; the timer ring exposes `role="progressbar"` with values;
  completion/validation feedback is text-based; the wallpaper scene is
  `aria-hidden`.
- **F032** — every compiled `transition-*` resolves to
  `var(--motion-duration)`/`var(--motion-ease)`; the
  `prefers-reduced-motion: reduce` kill switch plus `no-preference` wrappers
  cover all animations.
- **F034** — no horizontal scroll anywhere; timer stage dominant (≥25% of
  viewport height); Start fully inside the viewport and clear of the fixed
  bottom nav at rest, and the whole stage clears the navs after scrolling to
  the bottom.
- **F015** — README rewritten and checked step by step (problem/MVP, clean
  setup, accurate scripts incl. the lint-before-build gotcha and the generated
  `public/sw.js` artifacts, App Router + Server/Client architecture, IndexedDB
  persistence, design tokens/assets and the `docs/pomodoro-draft.png` draft).

### Fixed during verification (P5)

- Commit `0cb59e4` ("fix: update logo and styles") accidentally removed the
  pre-paint theme `<script>` from `app/layout.tsx` while leaving the
  `themeScript` constant behind: the F024 anti-flash behavior was gone and
  ESLint warned about the unused constant. The script tag was restored.
- On short viewports the fixed bottom nav (≈82px tall including its inset)
  overlapped the timer stage. The short-mode container padding was raised from
  `pb-20` (80px) to `pb-24` (96px) and the landscape ring compressed to
  `min(32dvh, 9.5rem)` so the Start button stays fully above the nav at rest.
- Settings and Tasks inputs carried `outline-none`, killing the global
  `:focus-visible` outline; the class was removed so keyboard focus is always
  visible (F013).

## Still blocked outside this phase

- **F017 — wallpaper asset.** The shell still uses the CSS/SVG ambient scene in
  `app/components/ambient-background.tsx`; the draft's full-bleed artwork and
  the `next/image` step are unimplemented, so F017 stays `false`. F033's
  "wallpaper renders offline" step was verified against that scene.
- **F027 — timer accuracy.** The mocked-clock test now exists
  (`app/lib/countdown-core.test.ts`, F014), but background-tab/sleep accuracy
  has not been re-verified since the feature was scoped, so it stays `false`.

## Generated artifacts

`public/sw.js` and `public/swe-worker-*.js` are build outputs. They are
gitignored and untracked; `npm run build` regenerates them and they must never
be committed. CI (or a pre-commit hook) should fail if either path becomes
tracked again.
