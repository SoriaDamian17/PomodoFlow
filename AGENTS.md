# AGENTS.md

Early-stage offline-first Pomodoro PWA: Next.js 16 App Router, React 19, Tailwind v4, Serwist service worker, IndexedDB (`idb`). `app/page.tsx` is still the create-next-app template, so most product code does not exist yet. Ignore `README.md`; it is unmodified create-next-app boilerplate.

## Commands

Use npm only (`package-lock.json`); the yarn/pnpm/bun hints in the README are boilerplate.

```bash
npm run dev                 # Turbopack; service worker disabled
npm run build               # Webpack (required by Serwist); also runs the TS check
npm start                   # production server — needed to test the SW / offline behavior
npx eslint app              # lint source only (see gotcha below)
npx tsc --noEmit            # only meaningful after one `dev`/`build` run
```

Correct verification order: `npx eslint app` → `npm run build`. There are no tests, no CI, and no typecheck script.

## Gotchas

- **Do not switch `build` to Turbopack.** `next.config.ts` wraps the config with `@serwist/next`; the service worker (`app/sw.ts` → `public/sw.js`) is bundled by Webpack. Dev intentionally runs Turbopack with Serwist disabled via `NODE_ENV === "development"`.
- **`build` writes `public/sw.js` and `public/swe-worker-*.js`, which are not gitignored.** They appear as untracked files. Never commit them.
- **`npm run lint` fails after a build** (`@typescript-eslint/no-this-alias` inside the generated minified `public/sw.js`), because `eslint.config.mjs` only ignores `.next`, `out`, `build`. Lint before building, or scope to `npx eslint app`, or delete the generated files first.
- **`tsc --noEmit` fails on a fresh clone** with `Cannot find name 'LayoutProps'` (see `app/layout.tsx`). Next 16 generates `LayoutProps`/`PageProps` into `.next/types`, which `next-env.d.ts` imports and which is gitignored; run `npm run dev` or `npm run build` first.
- PWA behavior only exists in production: `disable` in `next.config.ts` keeps the SW off in dev. Test offline/caching with `npm run build && npm start`.
- `app/manifest.ts` references `/icons/icon-192x192.svg` and `/icons/icon-512x512.svg`, which do not exist in `public/`. Add them when touching installability.

## Architecture notes

- Path alias `@/*` → **repo root**, not `src/` (e.g. `@/app/lib/db`). There is no `src/` directory; everything lives in `app/`.
- Tailwind v4 is CSS-first: no `tailwind.config.*`. Theme tokens and dark mode live in `app/globals.css` (`@theme inline`, `prefers-color-scheme`); `@tailwindcss/turbopack` is the dev plugin.
- IndexedDB (`app/lib/db.ts`): DB `pomodoro-db` v1, single `todos` store keyed by `id`, index `by-synced`. Changing the schema requires bumping the version and editing `upgrade()` in place — no migrations system.
- Sync semantics: `updateTodo` always forces `synced: false`; `deleteTodo` hard-deletes with no tombstone, so deletions cannot be synced. Keep that in mind before building real offline sync.
- `app/lib/sync.ts` is a stub that only flips local `synced` flags, and it registers a `window` listener at module scope. Import it only from client components; there are no API routes or server endpoints yet.
