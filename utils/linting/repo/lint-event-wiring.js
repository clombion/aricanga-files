#!/usr/bin/env node
/**
 * lint-event-wiring.js - Verify event system integrity
 *
 * Parses EVENTS object constants and checks that:
 * - All emitted events have at least one subscriber
 * - All subscribed events are actually emitted
 *
 * Resolves EVENTS.FOO to actual event strings for accurate matching.
 *
 * Usage:
 *   node utils/linting/repo/lint-event-wiring.js            # Check wiring
 *   node utils/linting/repo/lint-event-wiring.js --snapshot # Capture baseline
 *   node utils/linting/repo/lint-event-wiring.js --compare  # Compare to baseline
 *
 * Exit code: 0 if all events wired, 1 if orphaned events found
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_DIRS = [
  'packages/framework/src/foundation',
  'packages/framework/src/systems',
  'implementations',
];

const SKIP_DIRS = ['generated', 'vendor', 'node_modules', 'dist', 'data', 'ink', 'css', 'assets'];
const CACHE_DIR = '.lint-cache';
const SNAPSHOT_FILE = join(CACHE_DIR, 'event-wiring-snapshot.json');

// Path to EVENTS definition
const EVENTS_FILE = 'packages/framework/src/systems/conversation/events/events.js';

// Patterns (include TIME_EVENTS from foundation/services/time-context.js)
const EMIT_PATTERN = /eventBus\.emit\s*\(\s*(?:EVENTS|OS_EVENTS|CONV_EVENTS|TIME_EVENTS)\.(\w+)/g;
const SUBSCRIBE_PATTERN = /eventBus\.on\s*\(\s*(?:EVENTS|OS_EVENTS|CONV_EVENTS|TIME_EVENTS)\.(\w+)/g;
const DIRECT_EMIT_PATTERN = /eventBus\.emit\s*\(\s*['"]([^'"]+)['"]/g;
const DIRECT_SUBSCRIBE_PATTERN = /eventBus\.on\s*\(\s*['"]([^'"]+)['"]/g;

const args = process.argv.slice(2);
const doSnapshot = args.includes('--snapshot');
const doCompare = args.includes('--compare');

/**
 * Parse EVENTS object from events.js
 */
function parseEventsObject() {
  if (!existsSync(EVENTS_FILE)) {
    console.error(`Error: Events file not found at ${EVENTS_FILE}`);
    process.exit(1);
  }

  const content = readFileSync(EVENTS_FILE, 'utf-8');
  const events = {};

  // Match: CONSTANT_NAME: 'actual-event-string',
  const pattern = /(\w+):\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    events[match[1]] = match[2];
  }

  return events;
}

/**
 * Get all JS files in directories
 */
function getJsFiles(dirs) {
  const files = [];

  function walk(dir) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }

  for (const dir of dirs) {
    walk(dir);
  }

  return files;
}

/**
 * Find all event emissions and subscriptions in the codebase
 */
function findEventUsage(files, eventsMap) {
  const emissions = new Map();  // event string -> [files]
  const subscriptions = new Map();  // event string -> [files]

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const relPath = relative(process.cwd(), file);

    let match;

    // EVENTS.CONSTANT emissions
    const emitRegex = new RegExp(EMIT_PATTERN.source, 'g');
    while ((match = emitRegex.exec(content)) !== null) {
      const eventString = eventsMap[match[1]];
      if (eventString) {
        if (!emissions.has(eventString)) emissions.set(eventString, []);
        emissions.get(eventString).push(relPath);
      }
    }

    // EVENTS.CONSTANT subscriptions
    const subscribeRegex = new RegExp(SUBSCRIBE_PATTERN.source, 'g');
    while ((match = subscribeRegex.exec(content)) !== null) {
      const eventString = eventsMap[match[1]];
      if (eventString) {
        if (!subscriptions.has(eventString)) subscriptions.set(eventString, []);
        subscriptions.get(eventString).push(relPath);
      }
    }

    // Direct string emissions (for edge cases)
    const directEmitRegex = new RegExp(DIRECT_EMIT_PATTERN.source, 'g');
    while ((match = directEmitRegex.exec(content)) !== null) {
      const eventString = match[1];
      if (!emissions.has(eventString)) emissions.set(eventString, []);
      emissions.get(eventString).push(relPath);
    }

    // Direct string subscriptions
    const directSubRegex = new RegExp(DIRECT_SUBSCRIBE_PATTERN.source, 'g');
    while ((match = directSubRegex.exec(content)) !== null) {
      const eventString = match[1];
      if (!subscriptions.has(eventString)) subscriptions.set(eventString, []);
      subscriptions.get(eventString).push(relPath);
    }
  }

  return {
    emissions: Object.fromEntries(emissions),
    subscriptions: Object.fromEntries(subscriptions),
  };
}

// Main
const eventsMap = parseEventsObject();
console.log(`Parsed ${Object.keys(eventsMap).length} event constants from ${EVENTS_FILE}\n`);

const files = getJsFiles(SOURCE_DIRS);
const usage = findEventUsage(files, eventsMap);

if (doSnapshot) {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  writeFileSync(SNAPSHOT_FILE, JSON.stringify(usage, null, 2));
  console.log(`Snapshot saved to ${SNAPSHOT_FILE}`);
  console.log(`  Emissions: ${Object.keys(usage.emissions).length} events`);
  console.log(`  Subscriptions: ${Object.keys(usage.subscriptions).length} events`);
  process.exit(0);
}

if (doCompare) {
  if (!existsSync(SNAPSHOT_FILE)) {
    console.error(`Error: No snapshot found at ${SNAPSHOT_FILE}`);
    console.error('Run with --snapshot first');
    process.exit(1);
  }

  const snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'));

  // Compare emissions
  const missingEmissions = Object.keys(snapshot.emissions).filter(
    e => !usage.emissions[e]
  );
  const missingSubscriptions = Object.keys(snapshot.subscriptions).filter(
    e => !usage.subscriptions[e]
  );

  if (missingEmissions.length === 0 && missingSubscriptions.length === 0) {
    console.log('✓ Event wiring matches snapshot');
    process.exit(0);
  } else {
    console.log('Event wiring differences from snapshot:\n');
    if (missingEmissions.length > 0) {
      console.log('  Missing emissions:');
      for (const e of missingEmissions) {
        console.log(`    ${e}`);
      }
    }
    if (missingSubscriptions.length > 0) {
      console.log('  Missing subscriptions:');
      for (const e of missingSubscriptions) {
        console.log(`    ${e}`);
      }
    }
    process.exit(1);
  }
}

// Default: check for orphaned events
console.log('Checking event wiring...\n');

const emittedEvents = new Set(Object.keys(usage.emissions));
const subscribedEvents = new Set(Object.keys(usage.subscriptions));

// Events emitted but never subscribed (may be OK for external consumption)
const orphanedEmissions = [...emittedEvents].filter(e => !subscribedEvents.has(e));

// Events subscribed but never emitted (likely a bug)
const orphanedSubscriptions = [...subscribedEvents].filter(e => !emittedEvents.has(e));

// Events in EVENTS constant but never used
const unusedConstants = Object.entries(eventsMap)
  .filter(([_, eventString]) => !emittedEvents.has(eventString) && !subscribedEvents.has(eventString))
  .map(([name, _]) => name);

let hasErrors = false;

if (orphanedSubscriptions.length > 0) {
  console.log('Subscribed but never emitted (likely bugs):');
  for (const e of orphanedSubscriptions) {
    console.log(`  ${e}`);
    console.log(`    Subscribers: ${usage.subscriptions[e].join(', ')}`);
  }
  console.log();
  hasErrors = true;
}

if (orphanedEmissions.length > 0) {
  console.log('Emitted but never subscribed (may be intentional):');
  for (const e of orphanedEmissions) {
    console.log(`  ${e}`);
  }
  console.log();
}

if (unusedConstants.length > 0) {
  console.log('Unused event constants:');
  for (const e of unusedConstants) {
    console.log(`  EVENTS.${e}`);
  }
  console.log();
}

console.log(`Summary:`);
console.log(`  Events emitted: ${emittedEvents.size}`);
console.log(`  Events subscribed: ${subscribedEvents.size}`);
console.log(`  Orphaned emissions: ${orphanedEmissions.length}`);
console.log(`  Orphaned subscriptions: ${orphanedSubscriptions.length}`);
console.log(`  Unused constants: ${unusedConstants.length}`);

if (hasErrors) {
  console.log('\n✗ Event wiring issues detected');
  process.exit(1);
} else {
  console.log('\n✓ Event wiring looks healthy');
  process.exit(0);
}
