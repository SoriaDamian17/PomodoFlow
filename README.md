# PomodoroFlow

An **offline-first Pomodoro timer PWA** for people who want to protect focus
time without trusting the network. Run a focus session on a plane, in a tunnel
or behind a corporate firewall: the timer, your tasks, settings and session
history all work from the first visit onward, and the app installs to the
desktop or home screen like a native app.

The MVP ships the full loop of a Pomodoro workflow:

- **Timer** — focus / short-break / long-break modes with a radial progress
  ring, reliable wall-clock countdown (survives throttled background tabs and
  device sleep) and pause/resume/reset.
- **Tasks** — a task list with priority and status, and a "focus task" you
  attach to completed sessions so insights stay meaningful.
- **Insights** — per-day totals, weekly summaries and streaks computed from
  completed focus sessions.
- **Ambient music** — three synthesized focus loops with a persistent volume
  and mute state (see [`docs/audio.md`](docs/audio.md)).
- **Settings** — per-mode durations with inline validation, light/dark theme.
- **Offline PWA** — installable manifest, service worker precache, offline
  indicator and an explicit "new version is ready" reload prompt (a running
  timer is never interrupted by a deploy).

The visual language is taken from the design draft
[`docs/pomodoro-draft.png`](docs/pomodoro-draft.png): dark glass surfaces, a
coral accent (`#FD8464`) and pill geometry over an ambient dusk scene.

## Getting started

Requirements: **Node 20+** and **npm** (this repo uses `package-lock.json`;
yarn/pnpm/bun are not supported).

```bash
git clone <repo-url> PomodoFlow
cd PomodoFlow
npm install
npm run dev        # http://localhost:3000
```

Production build (required to exercise the service worker — see below):

```bash
npm run build
npm start          # http://localhost:3000
```

## Scripts

| Command             | What it does                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run dev`       | Turbopack dev server. Serwist is **disabled** in development, so there is no service worker in `next dev`.       |
| `npm run build`     | Production build with **Webpack** (not Turbopack) because Serwist bundles `app/sw.ts` → `public/sw.js`. Also runs the TypeScript check. |
| `npm start`         | Serves the production build. The PWA/offline behavior only exists here.                                          |
| `npm run lint`      | ESLint over the whole repo. **See the gotcha below.**                                                             |
| `npm test`          | Vitest unit tests (`app/**/*.test.ts`) with a deterministic clock and mocked storage.                            |
| `npm run assets:icons` | Regenerates the PWA icons in `public/icons/` from the source artwork.                                         |
| `npm run assets:audio` | Regenerates the three ambient MP3s in `public/audio/` deterministically (see [`docs/audio.md`](docs/audio.md)). |

Recommended verification order before shipping a change:

```bash
npx eslint app      # or `npm run lint` before building — see gotcha
npm test
npm run build
```

### Gotchas

- **Lint before build.** `npm run build` writes the *generated* files
  `public/sw.js` and `public/swe-worker-*.js`. They are minified bundles, and
  ESLint chokes on them (`@typescript-eslint/no-this-alias` inside the generated
  code) because `eslint.config.mjs` only ignores `.next`, `out` and `build`.
  Run the linter before building, scope it (`npx eslint app`), or delete the
  generated files first.
- **Never commit the generated worker files.** `public/sw.js` and
  `public/swe-worker-*.js` are build outputs. If they show up as modified after
  a verification build, restore them (`git checkout -- public/sw.js`).
- **Do not switch the build to Turbopack.** `next.config.ts` wraps the config
  with `@serwist/next`; the service worker is bundled by Webpack. Dev
  intentionally runs Turbopack with Serwist disabled via
  `NODE_ENV === "development"`.
- **`npx tsc --noEmit` fails on a fresh clone** until you run `npm run dev` or
  `npm run build` once: Next.js 16 generates `LayoutProps`/`PageProps` into
  `.next/types`, which is gitignored.

## Architecture

Built on **Next.js 16 (App Router)** with React 19 and Tailwind v4.

- `app/page.tsx` is a **Server Component** shell: it composes the ambient
  background with the dashboard and the global status surfaces
  (`OfflineIndicator`, `ServiceWorkerUpdate`).
- Interactivity is pushed into small **`"use client"` leaves** —
  `pomodoro-dashboard.tsx` plus the sheets (tasks, settings, insights, streaks,
  music). Server/Client boundaries are kept as narrow as possible so the shell
  ships minimal client JS.
- The path alias `@/*` maps to the **repo root** (there is no `src/`;
  everything lives in `app/`). Pure logic is isolated in `app/lib/*` (countdown
  core, tasks, sessions, stats, settings, audio) so it is unit-testable
  without a browser.
- `app/manifest.ts` serves the web manifest, `app/sw.ts` is the Serwist service
  worker, and `app/icon.png` is the app icon.

### Persistence

All domain data lives in **IndexedDB** (via [`idb`](https://github.com/jakearchibald/idb))
in the `pomodoro-db` database (v3) with three stores: `todos`, `sessions` and
`tasks`. Schema changes are handled **in place** inside the `upgrade()` callback
in [`app/lib/db.ts`](app/lib/db.ts) — there is no migrations framework, so a new
store means bumping the version and editing `upgrade()`.

Small preferences (durations, theme, audio settings, timer snapshot) use
**`localStorage`**. Every read path is defensive: malformed rows and
unavailable storage (private mode, quota) fall back to defaults instead of
crashing, and the UI explains when persistence is unavailable.

## Design system

The single source of truth for the visual language is
[`app/globals.css`](app/globals.css), driven by the draft
[`docs/pomodoro-draft.png`](docs/pomodoro-draft.png):

- **Color tokens** in `@theme` — coral accent (`#FD8464`), glass surfaces, ring
  track/glow and the scene palette. Dark is the default; light is opt-in via
  `[data-theme="light"]` with an inline pre-paint script preventing a theme
  flash.
- **Motion tokens** — one shared duration/easing pair (`--motion-duration`,
  `--motion-ease`) feeding every `transition-*` utility, plus a global
  `prefers-reduced-motion` kill switch.
- **Touch target token** — `--touch-target` (44px) applied to every
  `button`/`select` (WCAG 2.5.5).
- **Wallpaper** — currently a CSS/SVG ambient scene
  (`app/components/ambient-background.tsx`, decorative and `aria-hidden`); the
  draft's full-bleed artwork is pending (tracked as F017).
- **Audio** — the three ambient loops are synthesized in-repo by
  `scripts/generate-audio.mjs` (no third-party samples); see
  [`docs/audio.md`](docs/audio.md).

## Testing

`npm test` runs the Vitest suite in `app/**/*.test.ts`: countdown transitions
with a mocked clock, duration validation, task validation and persistence
(including malformed/unavailable storage), session aggregation and daily/weekly
statistics, audio-settings parsing, and the IndexedDB upgrade path. The tests
use in-memory stand-ins for `localStorage`/IndexedDB, so they are deterministic
and run in a plain Node environment.

## Project docs

- [`docs/feature_list.json`](docs/feature_list.json) — acceptance checklist; a
  feature only flips to `passes: true` when every step is verified.
- [`docs/blockers.md`](docs/blockers.md) — why any step is still unverifiable.
- [`docs/audio.md`](docs/audio.md) — the synthesized ambient tracks.
- [`docs/pomodoro-draft.png`](docs/pomodoro-draft.png) — the design draft.
