import { describe, expect, it } from "vitest";
import {
  createCountdown,
  pauseCountdown,
  remainingOf,
  resetCountdown,
  restoreCountdown,
  startCountdown,
  tickCountdown,
} from "@/app/lib/countdown-core";

const MINUTE = 60_000;

/** Deterministic clock: every step is explicit, no timers involved. */
const T0 = 1_700_000_000_000;

describe("countdown-core (F027)", () => {
  it("derives remaining time from the target timestamp, not interval decrements", () => {
    const durationMs = 25 * MINUTE;
    let state = createCountdown(durationMs);

    state = startCountdown(state, T0);
    expect(state.status).toBe("running");
    expect(state.endsAt).toBe(T0 + durationMs);

    // Two ticks 90 seconds apart report the exact wall-clock remainder even
    // though no intermediate ticks happened (throttled background tab).
    const first = tickCountdown(state, T0 + 90_000);
    expect(first.state.remainingMs).toBe(durationMs - 90_000);

    const second = tickCountdown(first.state, T0 + 180_000);
    expect(second.state.remainingMs).toBe(durationMs - 180_000);
  });

  it("advances through start, pause, resume and completion on a mocked clock", () => {
    const durationMs = 25 * MINUTE;
    let state = createCountdown(durationMs);

    // Start, run for 10 minutes.
    state = startCountdown(state, T0);
    state = tickCountdown(state, T0 + 10 * MINUTE).state;
    expect(remainingOf(state, T0 + 10 * MINUTE)).toBe(15 * MINUTE);

    // Pause and hold for an hour: the remaining time must not move.
    state = pauseCountdown(state, T0 + 10 * MINUTE);
    expect(state.status).toBe("paused");
    state = tickCountdown(state, T0 + 70 * MINUTE).state;
    expect(remainingOf(state, T0 + 70 * MINUTE)).toBe(15 * MINUTE);
    expect(state.endsAt).toBeNull();

    // Resume: the 15 minutes continue from now, not from the original target.
    state = startCountdown(state, T0 + 70 * MINUTE);
    expect(state.endsAt).toBe(T0 + 85 * MINUTE);

    const beforeEnd = tickCountdown(state, T0 + 84 * MINUTE + 59_000);
    expect(beforeEnd.completed).toBe(false);
    expect(beforeEnd.state.remainingMs).toBe(1_000);

    const atEnd = tickCountdown(beforeEnd.state, T0 + 85 * MINUTE);
    expect(atEnd.completed).toBe(true);
    expect(atEnd.state.status).toBe("completed");
    expect(atEnd.state.remainingMs).toBe(0);
    expect(atEnd.state.endsAt).toBeNull();
  });

  it("reports completion exactly once and never stores negative time", () => {
    const state = startCountdown(createCountdown(5 * MINUTE), T0);

    // System sleep jumps the clock far past the target.
    const wake = tickCountdown(state, T0 + 42 * MINUTE);
    expect(wake.completed).toBe(true);
    expect(wake.state.remainingMs).toBe(0);

    const later = tickCountdown(wake.state, T0 + 60 * MINUTE);
    expect(later.completed).toBe(false);
    expect(later.state.status).toBe("completed");
    expect(remainingOf(later.state, T0 + 60 * MINUTE)).toBe(0);

    const evenLater = tickCountdown(later.state, T0 + 120 * MINUTE);
    expect(evenLater.completed).toBe(false);
    expect(evenLater.state.remainingMs).toBe(0);
  });

  it("never completes from idle, paused or reset states", () => {
    expect(tickCountdown(createCountdown(MINUTE), T0 + 10 * MINUTE).completed).toBe(false);

    const paused = pauseCountdown(startCountdown(createCountdown(MINUTE), T0), T0);
    expect(tickCountdown(paused, T0 + 10 * MINUTE).completed).toBe(false);

    const reset = resetCountdown(startCountdown(createCountdown(MINUTE), T0));
    expect(reset.status).toBe("idle");
    expect(reset.remainingMs).toBe(MINUTE);
    expect(tickCountdown(reset, T0 + 10 * MINUTE).completed).toBe(false);
  });

  it("restarts at full length after a completion (Start pill reset)", () => {
    const durationMs = 5 * MINUTE;
    let state = startCountdown(createCountdown(durationMs), T0);
    state = tickCountdown(state, T0 + durationMs).state;
    expect(state.status).toBe("completed");

    state = startCountdown(state, T0 + durationMs + 30_000);
    expect(state.status).toBe("running");
    expect(state.endsAt).toBe(T0 + durationMs + 30_000 + durationMs);
    expect(state.remainingMs).toBe(durationMs);
  });

  it("ignores a repeated start while running (no concurrent countdowns)", () => {
    const state = startCountdown(createCountdown(10 * MINUTE), T0);
    const restarted = startCountdown(state, T0 + MINUTE);
    expect(restarted).toBe(state);
    expect(restarted.endsAt).toBe(T0 + 10 * MINUTE);
  });
});

describe("restoreCountdown (F027 reload restore)", () => {
  it("restores a running session from its stored target time", () => {
    const restored = restoreCountdown(
      { status: "running", durationMs: 25 * MINUTE, endsAt: T0 + 10 * MINUTE, remainingMs: 0 },
      T0,
    );

    expect(restored).not.toBeNull();
    expect(restored!.status).toBe("running");
    expect(restored!.endsAt).toBe(T0 + 10 * MINUTE);
    expect(restored!.remainingMs).toBe(10 * MINUTE);
  });

  it("restores a paused session with its frozen remaining time", () => {
    const restored = restoreCountdown(
      {
        status: "paused",
        durationMs: 25 * MINUTE,
        endsAt: null,
        remainingMs: 7 * MINUTE + 30_000,
      },
      T0,
    );

    expect(restored).toEqual({
      status: "paused",
      durationMs: 25 * MINUTE,
      endsAt: null,
      remainingMs: 7 * MINUTE + 30_000,
    });
  });

  it("abandons a session whose target time already passed while closed", () => {
    expect(
      restoreCountdown(
        { status: "running", durationMs: 25 * MINUTE, endsAt: T0 - 1, remainingMs: 0 },
        T0,
      ),
    ).toBeNull();
  });

  it("rejects malformed or unusable snapshots", () => {
    expect(
      restoreCountdown(
        { status: "running", durationMs: 25 * MINUTE, endsAt: Number.NaN, remainingMs: 0 },
        T0,
      ),
    ).toBeNull();
    expect(
      restoreCountdown(
        { status: "paused", durationMs: 0, endsAt: null, remainingMs: 0 },
        T0,
      ),
    ).toBeNull();
    expect(
      restoreCountdown(
        { status: "paused", durationMs: 25 * MINUTE, endsAt: null, remainingMs: 0 },
        T0,
      ),
    ).toBeNull();
    expect(
      restoreCountdown(
        {
          status: "paused",
          durationMs: 5 * MINUTE,
          endsAt: null,
          remainingMs: 99 * MINUTE,
        } as never,
        T0,
      )!.remainingMs,
    ).toBe(5 * MINUTE);
  });

  it("keeps the restored session accurate as the clock advances", () => {
    const restored = restoreCountdown(
      { status: "running", durationMs: 25 * MINUTE, endsAt: T0 + 10 * MINUTE, remainingMs: 0 },
      T0,
    )!;

    const { state, completed } = tickCountdown(restored, T0 + 10 * MINUTE);
    expect(completed).toBe(true);
    expect(state.remainingMs).toBe(0);
  });
});
