/**
 * Generates the PWA icon set with no image dependencies (F031).
 *
 * Usage: node scripts/generate-icons.mjs
 *
 * The artwork mirrors the draft's timer ring: a coral progress arc with a head
 * dot on the app's dark navy background. Everything is drawn analytically per
 * pixel with smooth edge coverage, then encoded as PNG (RGBA, 8-bit) using
 * node:zlib for the IDAT stream.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

const ACCENT = [253, 132, 100];
const ACCENT_HOVER = [255, 154, 128];
const BACKGROUND_TOP = [19, 28, 52];
const BACKGROUND_BOTTOM = [11, 15, 26];
const TRACK = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Draws the icon into an RGBA buffer.
 *
 * @param {number} size
 * @param {{ scale?: number }} options
 */
function renderIcon(size, { scale = 1 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const radius = size * 0.29 * scale;
  const stroke = size * 0.068 * scale;
  const half = stroke / 2;
  const arcFraction = 0.72;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * arcFraction;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      let color = mix(BACKGROUND_TOP, BACKGROUND_BOTTOM, y / (size - 1));

      // Warm glow behind the ring, sampled from the draft's sunset.
      const glowDistance =
        Math.hypot(x - center, y - size * 0.52) / (size * 0.55);
      const glow = Math.max(0, 1 - glowDistance) ** 2 * 0.22;
      color = mix(color, ACCENT, glow);

      const dx = x - center;
      const dy = y - center;
      const distance = Math.hypot(dx, dy);
      const band =
        1 - smoothstep(half - 1.4, half + 1.4, Math.abs(distance - radius));

      if (band > 0) {
        // Faint full track, then the coral progress arc on top.
        color = mix(color, TRACK, 0.16 * band);

        const angle = Math.atan2(dy, dx);
        const normalized = (angle - startAngle + Math.PI * 2) % (Math.PI * 2);
        const inArc = normalized <= Math.PI * 2 * arcFraction;

        // Rounded caps: everything within `half` of either endpoint.
        const startX = center + Math.cos(startAngle) * radius;
        const startY = center + Math.sin(startAngle) * radius;
        const endX = center + Math.cos(endAngle) * radius;
        const endY = center + Math.sin(endAngle) * radius;
        const startCap =
          1 -
          smoothstep(
            half - 1.4,
            half + 1.4,
            Math.hypot(x - startX, y - startY),
          );
        const endCap =
          1 -
          smoothstep(
            half - 1.4,
            half + 1.4,
            Math.hypot(x - endX, y - endY),
          );
        const arc = Math.max(inArc ? band : 0, startCap, endCap);

        if (arc > 0) {
          const arcColor = mix(ACCENT, ACCENT_HOVER, 0.35);
          color = mix(color, arcColor, arc);
        }
      }

      // Leading head dot, slightly brighter than the arc.
      const headX = center + Math.cos(endAngle) * radius;
      const headY = center + Math.sin(endAngle) * radius;
      const headRadius = half * 0.86;
      const head =
        1 -
        smoothstep(
          headRadius - 1.2,
          headRadius + 1.2,
          Math.hypot(x - headX, y - headY),
        );
      if (head > 0) {
        color = mix(color, ACCENT_HOVER, head);
      }

      rgba[index] = Math.round(Math.min(255, Math.max(0, color[0])));
      rgba[index + 1] = Math.round(Math.min(255, Math.max(0, color[1])));
      rgba[index + 2] = Math.round(Math.min(255, Math.max(0, color[2])));
      rgba[index + 3] = 255;
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(outDir, { recursive: true });

const outputs = [
  ["icon-192x192.png", renderIcon(192)],
  ["icon-512x512.png", renderIcon(512)],
  [
    "icon-maskable-512x512.png",
    renderIcon(512, { scale: 0.72 }),
  ],
  ["apple-touch-icon.png", renderIcon(180)],
];

for (const [name, buffer] of outputs) {
  writeFileSync(join(outDir, name), buffer);
  console.log(`icon: public/icons/${name} (${buffer.length} bytes)`);
}

// Browser tab icon for Next's app/icon.png convention.
const appIcon = renderIcon(256);
writeFileSync(join(root, "app", "icon.png"), appIcon);
console.log(`icon: app/icon.png (${appIcon.length} bytes)`);
