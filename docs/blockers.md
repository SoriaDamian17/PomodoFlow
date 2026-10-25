# Blocked acceptance steps

Features are left at `passes: false` in `docs/feature_list.json` when at least one
listed step cannot be verified yet. This file records why, outside the backlog.

## F012 — Tasks, timer settings, streaks and session history persist

**Status:** blocked on the music player (F023, phase P4).

**Unverifiable steps**

- Step 1 — "Create a task, change timer settings, **select a track (F023)** and
  complete a focus session."
- Step 2 — "...verify tasks, settings, **selected track** and session history are
  restored."

There is no track selector or audio player in the app yet: the Music surface is
still the `COMING_SOON` placeholder in `app/components/pomodoro-dashboard.tsx`,
and F023 depends on F033 (bundled audio assets). Adding a fake or hard-coded
track list just to satisfy the step would not be a real implementation.

**Verified so far (headless Chrome against `npm start`, 16/16 checks)**

- Tasks, timer durations and focus-session history all survive a page refresh.
- A v2 database containing a `todos` row upgrades in place to v3
  (`todos`, `sessions`, `tasks`) with the todo untouched.
- Malformed `localStorage` durations and timer snapshots fall back to defaults
  without a crash, and malformed session rows are dropped by
  `parseStoredSession` / `parseStoredTask`.
- With `IDBFactory.prototype.open` throwing (private mode/quota simulation) the
  app boots, shows a global `role="alert"` banner plus per-sheet notices, and
  degrades to an explained empty state.
- An in-progress timer restores from its stored `endsAt` target and is not
  recorded until it actually completes.

**Unblock when** F023 (and F033) ship a real track selector: extend step 1/2 to
select a track, refresh, and confirm playback state is restored, then set F012
to `passes: true`.
