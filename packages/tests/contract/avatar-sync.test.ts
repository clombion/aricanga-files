/**
 * Contract tests: avatar.js ↔ build-config.js palette/lightness sync.
 *
 * Both files define AVATAR_PALETTE and BG_LIGHTNESS independently (one is
 * an ES module, the other a Node script). These tests parse build-config.js
 * as text and verify the values match the avatar.js exports.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  hashName,
  avatarColorForName,
  avatarColors,
} from '../../framework/src/systems/conversation/utils/avatar.js';

// ---- helpers to extract constants from build-config.js --------------------

const BUILD_CONFIG_PATH = resolve(
  import.meta.dirname,
  '../../../utils/build/build-config.js',
);
const buildSrc = readFileSync(BUILD_CONFIG_PATH, 'utf-8');

/** Extract the AVATAR_PALETTE array from build-config.js source text. */
function parseBuildPalette(): Array<{ h: number; s: number }> {
  const match = buildSrc.match(
    /const AVATAR_PALETTE\s*=\s*\[([\s\S]*?)\];/,
  );
  if (!match) throw new Error('AVATAR_PALETTE not found in build-config.js');
  const entries: Array<{ h: number; s: number }> = [];
  for (const m of match[1].matchAll(/\{\s*h:\s*(\d+),\s*s:\s*(\d+)\s*\}/g)) {
    entries.push({ h: Number(m[1]), s: Number(m[2]) });
  }
  return entries;
}

/** Extract BG_LIGHTNESS from build-config.js source text. */
function parseBuildLightness(): number {
  const match = buildSrc.match(/const BG_LIGHTNESS\s*=\s*(\d+)/);
  if (!match) throw new Error('BG_LIGHTNESS not found in build-config.js');
  return Number(match[1]);
}

// ---- Import runtime values from avatar.js ---------------------------------

// avatar.js doesn't export the raw constants, so we derive them from the
// public API using a known-input probe.

/** Recover BG_LIGHTNESS and FG_LIGHTNESS from avatarColors output. */
function probeRuntimeLightness(): { bg: number; fg: number } {
  const { bg, fg } = avatarColors('probe');
  const bgL = Number(bg.match(/(\d+)%\)$/)![1]);
  const fgL = Number(fg.match(/(\d+)%\)$/)![1]);
  return { bg: bgL, fg: fgL };
}

/** Recover full runtime palette by hashing names 0..N and collecting entries. */
function probeRuntimePalette(): Array<{ h: number; s: number }> {
  // We need to find names that hit each palette index.
  // Brute-force: try names "a0", "a1", ... until we've seen all 14 indices.
  const seen = new Map<number, { h: number; s: number }>();
  const paletteSize = 14; // known size
  for (let i = 0; seen.size < paletteSize && i < 10000; i++) {
    const name = `probe${i}`;
    const idx = hashName(name) % paletteSize;
    if (!seen.has(idx)) {
      const entry = avatarColorForName(name);
      seen.set(idx, entry);
    }
  }
  // Return ordered by index
  return Array.from({ length: paletteSize }, (_, i) => seen.get(i)!);
}

// ---- Tests ----------------------------------------------------------------

describe('avatar palette sync (avatar.js ↔ build-config.js)', () => {
  const buildPalette = parseBuildPalette();
  const runtimePalette = probeRuntimePalette();

  it('palettes have the same length', () => {
    expect(buildPalette.length).toBe(runtimePalette.length);
  });

  it('each palette entry matches', () => {
    for (let i = 0; i < buildPalette.length; i++) {
      expect(runtimePalette[i], `palette index ${i}`).toEqual(buildPalette[i]);
    }
  });
});

describe('BG_LIGHTNESS sync (avatar.js ↔ build-config.js)', () => {
  it('build-config BG_LIGHTNESS matches runtime BG_LIGHTNESS', () => {
    const buildL = parseBuildLightness();
    const runtimeL = probeRuntimeLightness().bg;
    expect(runtimeL).toBe(buildL);
  });
});

describe('FG_LIGHTNESS contract', () => {
  it('fg lightness is less than bg lightness', () => {
    const { bg, fg } = probeRuntimeLightness();
    expect(fg).toBeLessThan(bg);
  });

  it('fg lightness provides sufficient contrast (at least 40 points from bg)', () => {
    const { bg, fg } = probeRuntimeLightness();
    expect(bg - fg).toBeGreaterThanOrEqual(40);
  });
});
