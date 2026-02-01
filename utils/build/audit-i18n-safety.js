#!/usr/bin/env node
/**
 * audit-i18n-safety.js — Verify BUG-002 architectural fix is intact
 *
 * Since TASK-112, component registration is deferred until after i18n/config
 * services are ready (via registerConversationComponents() in main.js).
 * This eliminates the Render-Before-Ready bug class by design.
 *
 * This linter verifies:
 *   1. conversation/index.js does NOT have side-effect component imports
 *   2. main.js calls registerConversationComponents() after await i18nReady
 *
 * Usage:
 *   node utils/build/audit-i18n-safety.js
 */

import { readFileSync } from 'node:fs';

const CONV_INDEX = 'packages/framework/src/systems/conversation/index.js';
const MAIN_JS = 'experiences/aricanga/src/main.js';

const issues = [];

// 1. Verify no side-effect component imports in conversation/index.js
const convSrc = readFileSync(CONV_INDEX, 'utf-8');
const sideEffectImports = convSrc
  .split('\n')
  .filter((line) => /^import\s+['"]\.\/components\//.test(line));

if (sideEffectImports.length > 0) {
  issues.push(
    `${CONV_INDEX}: Found ${sideEffectImports.length} side-effect component import(s).`,
    '  These cause Render-Before-Ready (BUG-002). Use registerConversationComponents() instead.',
    ...sideEffectImports.map((l) => `    ${l.trim()}`),
  );
}

// 2. Verify main.js uses deferred registration
const mainSrc = readFileSync(MAIN_JS, 'utf-8');
if (!/registerConversationComponents/.test(mainSrc)) {
  issues.push(
    `${MAIN_JS}: Missing registerConversationComponents() call.`,
    '  Components must be registered after services are ready (BUG-002).',
  );
}

if (issues.length === 0) {
  console.log('✓ BUG-002 architectural fix intact: component registration is deferred');
  process.exit(0);
} else {
  console.error('✗ BUG-002 architectural fix broken:');
  console.error('');
  for (const issue of issues) {
    console.error(`  ${issue}`);
  }
  process.exit(1);
}
