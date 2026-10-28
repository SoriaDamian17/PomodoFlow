import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DURATIONS,
  DURATIONS_STORAGE_KEY,
  isDurationValid,
  readStoredDurations,
  validateDurations,
  writeStoredDurations,
} from "@/app/lib/settings";

/** Installs a window whose localStorage delegates to the given raw payload. */
function stubStorage(
  raw: string | null,
  options: { throwing?: boolean } = {},
): { setItem: ReturnType<typeof vi.fn> } {
  const setItem = vi.fn(() => {
    if (options.throwing) throw new Error("QuotaExceededError");
  });

  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn(() => {
        if (options.throwing) throw new Error("SecurityError");
        return raw;
      }),
      setItem,
      removeItem: vi.fn(),
    },
    dispatchEvent: vi.fn(),
  });

  return { setItem };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isDurationValid (F003 limits)", () => {
  it("accepts whole numbers inside each mode's range", () => {
    expect(isDurationValid("focus", 25)).toBe(true);
    expect(isDurationValid("focus", 1)).toBe(true);
    expect(isDurationValid("focus", 120)).toBe(true);
    expect(isDurationValid("short", 60)).toBe(true);
    expect(isDurationValid("long", 15)).toBe(true);
  });

  it("rejects zero, negative, fractional, out-of-range and non-numeric values", () => {
    expect(isDurationValid("focus", 0)).toBe(false);
    expect(isDurationValid("focus", -5)).toBe(false);
    expect(isDurationValid("focus", 25.5)).toBe(false);
    expect(isDurationValid("focus", 121)).toBe(false);
    expect(isDurationValid("short", 61)).toBe(false);
    expect(isDurationValid("focus", Number.NaN)).toBe(false);
  });
});

describe("validateDurations (F003)", () => {
  it("accepts valid input for every mode", () => {
    const result = validateDurations({ focus: "50", short: "10", long: "20" });

    expect(result).toEqual({
      ok: true,
      durations: { focus: 50, short: 10, long: 20 },
    });
  });

  it("rejects invalid input per mode with an inline message", () => {
    const result = validateDurations({ focus: "0", short: "abc", long: "999" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.focus).toBeTruthy();
    expect(result.errors.short).toBeTruthy();
    expect(result.errors.long).toBeTruthy();
  });

  it("never lets an invalid field overwrite the other stored values", () => {
    // One bad mode fails the whole validation, so no durations are returned
    // for writing: the existing valid settings stay intact.
    const result = validateDurations({ focus: "30", short: "", long: "15" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.short).toBeTruthy();
    expect(result.errors.focus).toBeUndefined();
    expect(result.errors.long).toBeUndefined();
  });

  it("treats empty and whitespace-only input as missing", () => {
    const result = validateDurations({ focus: "  ", short: "5", long: "15" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.focus).toBeTruthy();
  });
});

describe("readStoredDurations (F012 recovery)", () => {
  it("returns defaults when nothing is stored", () => {
    stubStorage(null);
    expect(readStoredDurations()).toEqual(DEFAULT_DURATIONS);
  });

  it("returns defaults for malformed JSON", () => {
    stubStorage("{not json");
    expect(readStoredDurations()).toEqual(DEFAULT_DURATIONS);
    stubStorage('"a string"');
    expect(readStoredDurations()).toEqual(DEFAULT_DURATIONS);
  });

  it("keeps valid fields and falls back per field for invalid ones", () => {
    stubStorage(JSON.stringify({ focus: 45, short: "soon", long: -2 }));
    expect(readStoredDurations()).toEqual({ ...DEFAULT_DURATIONS, focus: 45 });
  });

  it("returns defaults when storage itself is unavailable", () => {
    stubStorage(null, { throwing: true });
    expect(readStoredDurations()).toEqual(DEFAULT_DURATIONS);
  });

  it("returns defaults outside the browser (SSR)", () => {
    expect(typeof window).toBe("undefined");
    expect(readStoredDurations()).toEqual(DEFAULT_DURATIONS);
  });
});

describe("writeStoredDurations (F012 unavailable storage)", () => {
  it("persists valid durations and notifies the same tab", () => {
    const { setItem } = stubStorage(null);

    writeStoredDurations({ focus: 45, short: 5, long: 15 });

    expect(setItem).toHaveBeenCalledWith(
      DURATIONS_STORAGE_KEY,
      JSON.stringify({ focus: 45, short: 5, long: 15 }),
    );
    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it("degrades silently when storage throws", () => {
    stubStorage(null, { throwing: true });

    expect(() =>
      writeStoredDurations({ focus: 45, short: 5, long: 15 }),
    ).not.toThrow();
  });
});
