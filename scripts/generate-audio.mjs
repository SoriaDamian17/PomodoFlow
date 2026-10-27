/**
 * Generates the three ambient loops used by the Music player (F023).
 *
 * Usage: node scripts/generate-audio.mjs
 *
 * The loops are synthesized from scratch: every partial is an integer multiple
 * of 1/24 Hz, so each track repeats sample-perfectly at the 24 s loop point.
 * Nothing is sampled or licensed from a third party. Output is mono MP3
 * (22050 Hz, 64 kbps), about 190 kB per track, which keeps the first visit
 * light and lets the service worker cache each loop only after it is played.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Mp3Encoder } from "@breezystack/lamejs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "audio");

const SAMPLE_RATE = 22050;
const DURATION_SECONDS = 24;
const SAMPLE_COUNT = SAMPLE_RATE * DURATION_SECONDS;
/** Lowest frequency that completes a whole cycle inside the loop. */
const BASE_HZ = 1 / DURATION_SECONDS;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rounds a frequency to the nearest seamless partial of the loop. */
function seamless(hz) {
  return Math.max(BASE_HZ, Math.round(hz / BASE_HZ) * BASE_HZ);
}

/**
 * Adds a bank of periodic partials with a 1/f^tilt spectrum, i.e. a wash that
 * sounds like filtered noise but loops without a click.
 */
function addNoiseWash(target, { seed, count, minHz, maxHz, tilt = 1.1, gain = 1 }) {
  const random = mulberry32(seed);
  const partials = [];

  for (let i = 0; i < count; i += 1) {
    const hz = seamless(minHz + (maxHz - minHz) * Math.pow(random(), 1.7));
    const amplitude = 1 / Math.pow(hz, tilt);
    partials.push({ hz, amplitude, phase: random() * Math.PI * 2 });
  }

  const total = partials.reduce((sum, partial) => sum + partial.amplitude, 0);
  const scale = gain / total;

  for (const { hz, amplitude, phase } of partials) {
    const step = (2 * Math.PI * hz) / SAMPLE_RATE;
    const stepCos = Math.cos(step);
    const stepSin = Math.sin(step);
    let cos = Math.cos(phase);
    let sin = Math.sin(phase);
    const amp = amplitude * scale;

    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      target[i] += sin * amp;
      const nextCos = cos * stepCos - sin * stepSin;
      sin = cos * stepSin + sin * stepCos;
      cos = nextCos;
    }
  }
}

/** Adds a sine with an optional slow tremolo, both locked to the loop. */
function addDrone(target, { hz, gain, tremoloHz = 0, tremoloDepth = 0, phase = 0 }) {
  const frequency = seamless(hz);
  const step = (2 * Math.PI * frequency) / SAMPLE_RATE;
  const tremoloStep = 2 * Math.PI * seamless(tremoloHz || BASE_HZ) / SAMPLE_RATE;
  let cos = Math.cos(phase);
  let sin = Math.sin(phase);
  const stepCos = Math.cos(step);
  const stepSin = Math.sin(step);
  let tremoloCos = Math.cos(0);
  let tremoloSin = Math.sin(0);
  const tremoloCosStep = Math.cos(tremoloStep);
  const tremoloSinStep = Math.sin(tremoloStep);

  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const modulation = tremoloDepth
      ? 1 - tremoloDepth + tremoloDepth * (0.5 + 0.5 * tremoloSin)
      : 1;
    target[i] += sin * gain * modulation;

    const nextCos = cos * stepCos - sin * stepSin;
    sin = cos * stepSin + sin * stepCos;
    cos = nextCos;

    if (tremoloDepth) {
      const nextTremoloCos = tremoloCos * tremoloCosStep - tremoloSin * tremoloSinStep;
      tremoloSin = tremoloCos * tremoloSinStep + tremoloSin * tremoloCosStep;
      tremoloCos = nextTremoloCos;
    }
  }
}

/** Sparse decaying plucks: rain drops on the pond. */
function addDroplets(target, { seed, count, gain }) {
  const random = mulberry32(seed);

  for (let d = 0; d < count; d += 1) {
    const start = Math.floor(
      DURATION_SECONDS * 0.15 * SAMPLE_RATE +
        random() * (SAMPLE_COUNT - DURATION_SECONDS * 0.45 * SAMPLE_RATE),
    );
    const hz = 640 + random() * 900;
    const decay = 0.006 + random() * 0.01;
    const amplitude = gain * (0.6 + random() * 0.4);
    const length = Math.min(SAMPLE_COUNT - start, Math.floor(SAMPLE_RATE * 0.7));

    for (let i = 0; i < length; i += 1) {
      const t = i / SAMPLE_RATE;
      const envelope = Math.exp(-t / decay) * (1 - i / length);
      target[start + i] += Math.sin(2 * Math.PI * hz * t) * envelope * amplitude;
    }
  }
}

function normalize(samples, peak) {
  let max = 0;
  for (let i = 0; i < samples.length; i += 1) {
    max = Math.max(max, Math.abs(samples[i]));
  }
  const scale = max > 0 ? peak / max : 0;

  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    // Soft clip instead of hard clamping, then convert to 16-bit PCM.
    const value = Math.tanh(samples[i] * scale);
    pcm[i] = Math.round(value * 32767);
  }
  return pcm;
}

function encodeMp3(pcm) {
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, 64);
  const chunks = [];
  const blockSize = 1152;

  for (let offset = 0; offset < pcm.length; offset += blockSize) {
    const block = pcm.subarray(offset, offset + blockSize);
    const encoded = encoder.encodeBuffer(block);
    if (encoded.length > 0) chunks.push(Buffer.from(encoded));
  }

  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(Buffer.from(tail));

  return Buffer.concat(chunks);
}

function buildRain() {
  const samples = new Float32Array(SAMPLE_COUNT);
  addNoiseWash(samples, {
    seed: 11,
    count: 320,
    minHz: 320,
    maxHz: 7200,
    tilt: 0.6,
    gain: 1,
  });
  addNoiseWash(samples, {
    seed: 23,
    count: 90,
    minHz: 120,
    maxHz: 520,
    tilt: 1.2,
    gain: 0.5,
  });
  addDrone(samples, {
    hz: 55,
    gain: 0.05,
    tremoloHz: 1 / 8,
    tremoloDepth: 0.35,
  });
  addDroplets(samples, { seed: 37, count: 18, gain: 0.08 });
  return normalize(samples, 0.82);
}

function buildForest() {
  const samples = new Float32Array(SAMPLE_COUNT);
  addDrone(samples, { hz: 110, gain: 0.2, tremoloHz: 1 / 12, tremoloDepth: 0.3 });
  addDrone(samples, { hz: 165, gain: 0.15, tremoloHz: 1 / 8, tremoloDepth: 0.35 });
  addDrone(samples, { hz: 220, gain: 0.1, tremoloHz: 1 / 6, tremoloDepth: 0.4 });
  addDrone(samples, { hz: 330, gain: 0.04, tremoloHz: 1 / 4, tremoloDepth: 0.5 });
  addNoiseWash(samples, {
    seed: 41,
    count: 260,
    minHz: 1400,
    maxHz: 9000,
    tilt: 0.9,
    gain: 0.16,
  });
  addNoiseWash(samples, {
    seed: 43,
    count: 80,
    minHz: 90,
    maxHz: 400,
    tilt: 1.4,
    gain: 0.35,
  });
  return normalize(samples, 0.78);
}

function buildWaves() {
  const samples = new Float32Array(SAMPLE_COUNT);
  const swell = new Float32Array(SAMPLE_COUNT);

  // Slow surf: 3 swells per loop, shaped so the wash breathes instead of pulsing.
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const t = i / SAMPLE_COUNT;
    const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t - Math.PI / 2);
    swell[i] = Math.pow(wave, 1.6);
  }

  const wash = new Float32Array(SAMPLE_COUNT);
  addNoiseWash(wash, {
    seed: 61,
    count: 300,
    minHz: 90,
    maxHz: 5200,
    tilt: 1.15,
    gain: 1,
  });
  addNoiseWash(wash, {
    seed: 67,
    count: 120,
    minHz: 900,
    maxHz: 6000,
    tilt: 1.3,
    gain: 0.25,
  });

  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    samples[i] += wash[i] * (0.55 + 0.45 * swell[i]);
  }

  addDrone(samples, {
    hz: 55,
    gain: 0.14,
    tremoloHz: 1 / 8,
    tremoloDepth: 0.4,
  });
  addDrone(samples, {
    hz: 82.5,
    gain: 0.08,
    tremoloHz: 1 / 12,
    tremoloDepth: 0.3,
  });
  return normalize(samples, 0.8);
}

const tracks = [
  ["rain-on-the-pond.mp3", buildRain()],
  ["forest-at-dusk.mp3", buildForest()],
  ["night-waves.mp3", buildWaves()],
];

mkdirSync(outDir, { recursive: true });

for (const [name, pcm] of tracks) {
  const buffer = encodeMp3(pcm);
  writeFileSync(join(outDir, name), buffer);
  console.log(`audio: public/audio/${name} (${(buffer.length / 1024).toFixed(0)} kB)`);
}
