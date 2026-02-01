#!/usr/bin/env node
/**
 * Optimize profile images — resize to 256×256, convert to JPEG quality 80
 *
 * Reads: experiences/{impl}/assets/profile_images/*.png
 * Outputs: experiences/{impl}/assets/profile_images/optimized/profile-{n}.jpg
 *
 * Skips files where output is newer than source (incremental).
 *
 * Usage: IMPL=aricanga node utils/build/optimize-images.js
 */

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { glob } from 'node:fs/promises';
import sharp from 'sharp';
import { getProjectRoot } from '../lib/locale-config.js';

const IMPL = process.env.IMPL;
if (!IMPL) {
  console.error('Error: IMPL environment variable is required.');
  process.exit(1);
}

const PROJECT_ROOT = getProjectRoot();
const SOURCE_DIR = join(PROJECT_ROOT, 'experiences', IMPL, 'assets', 'profile_images');
const OUTPUT_DIR = join(SOURCE_DIR, 'optimized');

mkdirSync(OUTPUT_DIR, { recursive: true });

const sources = [];
for await (const entry of glob(join(SOURCE_DIR, '*.png'))) {
  sources.push(entry);
}

if (sources.length === 0) {
  console.log('No profile images found to optimize.');
  process.exit(0);
}

let skipped = 0;
let processed = 0;

for (const src of sources.sort()) {
  const name = basename(src, '.png');
  const dest = join(OUTPUT_DIR, `${name}.jpg`);

  // Incremental: skip if output newer than source
  if (existsSync(dest)) {
    const srcMtime = statSync(src).mtimeMs;
    const destMtime = statSync(dest).mtimeMs;
    if (destMtime > srcMtime) {
      skipped++;
      continue;
    }
  }

  await sharp(src)
    .resize(256, 256, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(dest);

  const size = statSync(dest).size;
  console.log(`  ${name}.jpg (${(size / 1024).toFixed(1)}KB)`);
  processed++;
}

console.log(`✓ Profile images optimized: ${processed} processed, ${skipped} skipped`);
