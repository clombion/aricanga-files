#!/usr/bin/env node
/**
 * lint-seeds.js - Verify seeds.js is fresh and complete
 *
 * Checks:
 * 1. seeds.js exists
 * 2. For each chat in CHATS config, verify seeds[chatId] exists (except disappearing)
 * 3. Compare ink file mtime vs seeds.js mtime (warn if stale)
 * 4. Verify each seed has _isSeed: true
 *
 * Usage: node utils/linting/repo/lint-seeds.js
 *
 * Exit codes:
 *   0 - All checks pass
 *   1 - Errors found
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

const IMPL = process.env.IMPL || 'aricanga';
const SEEDS_PATH = join(
  PROJECT_ROOT,
  `experiences/${IMPL}/src/generated/seeds.js`,
);
const CONFIG_PATH = join(
  PROJECT_ROOT,
  `experiences/${IMPL}/src/generated/config.js`,
);
const INK_DIR = join(PROJECT_ROOT, `experiences/${IMPL}/ink`);

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`WARN: ${msg}`);
  warnings++;
}

function info(msg) {
  console.log(`INFO: ${msg}`);
}

async function main() {
  console.log('Linting seeds.js...\n');

  // 1. Check seeds.js exists
  if (!existsSync(SEEDS_PATH)) {
    error(`seeds.js not found at ${SEEDS_PATH}`);
    error('Run: mise run build:seeds');
    process.exit(1);
  }
  info(`Found seeds.js`);

  // 2. Load config and seeds
  let CHATS, SEEDS;
  try {
    const configModule = await import(CONFIG_PATH);
    CHATS = configModule.CHATS;
  } catch (e) {
    error(`Failed to load config: ${e.message}`);
    process.exit(1);
  }

  try {
    const seedsModule = await import(SEEDS_PATH);
    SEEDS = seedsModule.SEEDS;
  } catch (e) {
    error(`Failed to load seeds: ${e.message}`);
    process.exit(1);
  }

  // 3. Check each chat has seeds (except disappearing)
  for (const [chatId, config] of Object.entries(CHATS)) {
    if (config.chatType === 'disappearing') {
      // Disappearing chats should NOT have seeds
      if (SEEDS[chatId] && SEEDS[chatId].length > 0) {
        warn(`Disappearing chat "${chatId}" has ${SEEDS[chatId].length} seeds - should be empty`);
      }
      continue;
    }

    if (!SEEDS[chatId]) {
      error(`Missing seeds for chat "${chatId}"`);
      continue;
    }

    if (!Array.isArray(SEEDS[chatId])) {
      error(`seeds[${chatId}] is not an array`);
      continue;
    }

    info(`Chat "${chatId}" has ${SEEDS[chatId].length} seeds`);
  }

  // 4. Verify each seed has _isSeed: true
  let totalSeeds = 0;
  let missingMarker = 0;

  for (const [chatId, messages] of Object.entries(SEEDS)) {
    if (!Array.isArray(messages)) continue;

    for (const msg of messages) {
      totalSeeds++;
      if (msg._isSeed !== true) {
        error(`Seed in "${chatId}" missing _isSeed marker: ${JSON.stringify(msg).slice(0, 50)}...`);
        missingMarker++;
      }
    }
  }

  info(`Total seeds: ${totalSeeds}`);
  if (missingMarker > 0) {
    error(`${missingMarker} seeds missing _isSeed: true marker - notifications would fire!`);
  }

  // 5. Check freshness - compare ink mtime vs seeds.js mtime
  const seedsStat = statSync(SEEDS_PATH);
  const seedsMtime = seedsStat.mtimeMs;

  // Recursively find all .ink files
  function findInkFiles(dir, files = []) {
    if (!existsSync(dir)) return files;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        findInkFiles(fullPath, files);
      } else if (entry.name.endsWith('.ink')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const inkFiles = findInkFiles(INK_DIR);
  let staleCount = 0;

  for (const inkFile of inkFiles) {
    const inkStat = statSync(inkFile);
    if (inkStat.mtimeMs > seedsMtime) {
      warn(`Ink file modified after seeds.js: ${inkFile.replace(PROJECT_ROOT, '')}`);
      staleCount++;
    }
  }

  if (staleCount > 0) {
    warn(`${staleCount} ink files are newer than seeds.js - rebuild with: mise run build:seeds`);
  }

  // Summary
  console.log('');
  if (errors > 0) {
    console.log(`FAILED: ${errors} error(s), ${warnings} warning(s)`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`PASSED with ${warnings} warning(s)`);
    process.exit(0);
  } else {
    console.log('PASSED: All seeds valid');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
