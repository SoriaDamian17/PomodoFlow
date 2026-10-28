import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

/**
 * A1 regression guard: Chrome does not validate PNG pixels against the
 * manifest's `sizes`, so a wrong-sized icon installs without any error. Read
 * the IHDR header directly and fail when the declared size and the real size
 * diverge (or when a maskable icon is not square).
 */

const publicDir = fileURLToPath(new URL("../../public/", import.meta.url));

function readPngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  const signature = bytes.subarray(0, 8).toString("hex");
  expect(signature, `${path} is not a PNG`).toBe("89504e470d0a1a0a");

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

const EXPECTED_ICONS = [
  ["icons/icon-192x192.png", 192],
  ["icons/icon-512x512.png", 512],
  ["icons/icon-maskable-512x512.png", 512],
  ["icons/apple-touch-icon.png", 180],
] as const;

describe("PWA icon files", () => {
  it.each(EXPECTED_ICONS)("%s is a %ix%i square", (name, size) => {
    const { width, height } = readPngSize(`${publicDir}${name}`);
    expect({ width, height }).toEqual({ width: size, height: size });
  });

  it("every manifest icon matches its declared size", () => {
    const icons = manifest().icons ?? [];
    expect(icons.length).toBeGreaterThan(0);

    for (const icon of icons) {
      const src = String(icon.src);
      const declared = String(icon.sizes);
      const [width, height] = declared.split("x").map(Number);

      const actual = readPngSize(`${publicDir}${src.replace(/^\//, "")}`);
      expect(actual, `${src} declares ${declared}`).toEqual({ width, height });
    }
  });

  it("has a maskable icon inside the manifest", () => {
    const maskable = (manifest().icons ?? []).filter(
      (icon) => icon.purpose === "maskable",
    );
    expect(maskable).toHaveLength(1);
  });
});
