import { describe, expect, it } from "vitest";
import {
  AUDIO_TRACKS,
  DEFAULT_AUDIO_SETTINGS,
  clampVolume,
  getAudioTrack,
  isAudioTrackId,
  parseAudioSettings,
} from "@/app/lib/audio";

describe("parseAudioSettings (F023/F012)", () => {
  it("returns null for missing or unparsable payloads", () => {
    expect(parseAudioSettings(null)).toBeNull();
    expect(parseAudioSettings("")).toBeNull();
    expect(parseAudioSettings("{not json")).toBeNull();
    expect(parseAudioSettings('"a string"')).toBeNull();
    expect(parseAudioSettings("null")).toBeNull();
  });

  it("round-trips a valid payload", () => {
    const settings = { trackId: "night-waves", volume: 0.35, muted: true };

    expect(parseAudioSettings(JSON.stringify(settings))).toEqual(settings);
  });

  it("falls back per field instead of dropping the whole payload", () => {
    expect(
      parseAudioSettings(
        JSON.stringify({ trackId: "deleted-track", volume: 0.4, muted: true }),
      ),
    ).toEqual({ trackId: DEFAULT_AUDIO_SETTINGS.trackId, volume: 0.4, muted: true });

    expect(
      parseAudioSettings(
        JSON.stringify({ trackId: "forest-at-dusk", volume: "loud", muted: 1 }),
      ),
    ).toEqual({
      trackId: "forest-at-dusk",
      volume: DEFAULT_AUDIO_SETTINGS.volume,
      muted: DEFAULT_AUDIO_SETTINGS.muted,
    });
  });

  it("clamps a volume outside 0–1 and rejects non-finite numbers", () => {
    expect(parseAudioSettings('{"volume":7}')?.volume).toBe(1);
    expect(parseAudioSettings('{"volume":-2}')?.volume).toBe(0);
    // JSON cannot carry Infinity, so this arrives as null.
    expect(parseAudioSettings('{"volume":null}')?.volume).toBe(
      DEFAULT_AUDIO_SETTINGS.volume,
    );
  });
});

describe("audio catalog", () => {
  it("only accepts known track ids", () => {
    for (const track of AUDIO_TRACKS) {
      expect(isAudioTrackId(track.id)).toBe(true);
      expect(track.src).toBe(`/audio/${track.id}.mp3`);
    }

    expect(isAudioTrackId("rain-on-the-pond")).toBe(true);
    expect(isAudioTrackId("unknown")).toBe(false);
    expect(isAudioTrackId(undefined)).toBe(false);
  });

  it("falls back to the first track for stale ids", () => {
    expect(getAudioTrack("removed-track")).toBe(AUDIO_TRACKS[0]);
    expect(getAudioTrack("night-waves").title).toBe("Night waves");
  });

  it("keeps clampVolume inside 0–1", () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(4)).toBe(1);
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_AUDIO_SETTINGS.volume);
  });
});
