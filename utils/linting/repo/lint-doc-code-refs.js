#!/usr/bin/env node
/**
 * lint-doc-code-refs.js - Verify documentation references match actual code
 * CQO-26: Doc-Code Consistency (blocking)
 *
 * Scans documentation for code references and verifies they exist:
 * - Function calls: functionName() patterns
 * - Method calls: .methodName( patterns
 * - Event names: EVENTS.NAME or 'event-name' patterns
 *
 * Usage: node utils/linting/repo/lint-doc-code-refs.js
 * Exit code: 0 if pass, 1 if violations found
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseMarkdown, visitNodes, contentHash } from '../lib/remark-utils.js';

// Scope: all docs under docs/
const DOC_DIRS = ['docs'];

// Source directories for building code index
const SOURCE_DIRS = [
  'packages/framework/src',
  'experiences/aricanga/src',
  'packages/test-utils/src',
];

// Additional patterns to index (internal functions that are documented)
const DOCUMENTED_INTERNALS = new Set([
  // XState machine actions/guards (documented in architecture.md)
  'processStoryChunk',
  'captureTaggedChoices',
  // Test helper methods (documented in testing.md)
  'goto',
  'chatItem',
  'chatItemBtn',
  'hasUnreadIndicator',
  'isVisible',
  'waitForMessage',
  'waitForMessageCount',
  'waitForChoices',
  'selectChoiceByIndex',
  'goBack',
  'selectChoice',
  'getPhoneTime',
  'getMessageText',
  // Notification helpers
  'waitForNotification',
  'dismissAndSettle',
  // Common test patterns
  'installClock',
  'advance',
  // Test helper methods (testing guide)
  'getMessageCount',
  'isTypingIndicatorVisible',
  'waitForTypingIndicator',
  'waitForTypingIndicatorHidden',
]);

const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

// ============================================================================
// Code Index Building
// ============================================================================

const exportedFunctions = new Set();
const exportedMethods = new Map(); // Map<className, Set<methodName>>
const definedEvents = new Set();

/**
 * Extract exported functions and class methods from JS files
 */
function indexSourceFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // Exported functions: export function name(
  const funcPattern = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;
  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    exportedFunctions.add(match[1]);
  }

  // Named exports: export { name1, name2 }
  const namedExportPattern = /export\s*\{\s*([^}]+)\s*\}/g;
  while ((match = namedExportPattern.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
    names.forEach(n => exportedFunctions.add(n));
  }

  // Const exports: export const name =
  const constExportPattern = /export\s+const\s+(\w+)\s*=/g;
  while ((match = constExportPattern.exec(content)) !== null) {
    exportedFunctions.add(match[1]);
  }

  // Special case: external-functions.js exports functions via return object
  // Pattern: name: (args) => or name: function
  if (filePath.includes('external-functions')) {
    const returnObjPattern = /^\s{4}(\w+)\s*:/gm;
    while ((match = returnObjPattern.exec(content)) !== null) {
      exportedFunctions.add(match[1]);
    }
  }

  // Also capture functions defined with JSDoc comments
  // Pattern: /** ... */ followed by methodName(
  const jsdocFuncPattern = /\/\*\*[\s\S]*?\*\/\s*(\w+)\s*:\s*(?:\([^)]*\)|function)/g;
  while ((match = jsdocFuncPattern.exec(content)) !== null) {
    exportedFunctions.add(match[1]);
  }

  // Class methods: class X { method( }
  const classPattern = /class\s+(\w+)[\s\S]*?\{([\s\S]*?)\n\}/g;
  while ((match = classPattern.exec(content)) !== null) {
    const className = match[1];
    const classBody = match[2];

    if (!exportedMethods.has(className)) {
      exportedMethods.set(className, new Set());
    }

    // Method definitions: methodName( or async methodName(
    const methodPattern = /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm;
    let methodMatch;
    while ((methodMatch = methodPattern.exec(classBody)) !== null) {
      const methodName = methodMatch[1];
      if (methodName !== 'constructor') {
        exportedMethods.get(className).add(methodName);
      }
    }
  }
}

/**
 * Extract defined events from events.js files
 */
function indexEventsFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // OS_EVENTS or similar constant definitions
  const eventPattern = /(\w+):\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = eventPattern.exec(content)) !== null) {
    definedEvents.add(match[1]); // Constant name
    definedEvents.add(match[2]); // Event string value
  }
}

/**
 * Build index of all source files
 */
function buildCodeIndex() {
  function walkDir(dir) {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'generated') {
        continue;
      }

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.js')) {
        indexSourceFile(fullPath);

        // Special handling for event definition files
        // Check filename OR file content for *_EVENTS exports
        if (entry.name.includes('event') || entry.name.includes('Event')) {
          indexEventsFile(fullPath);
        } else {
          // Check if file exports *_EVENTS constants
          const content = readFileSync(fullPath, 'utf-8');
          if (/export\s+const\s+\w*EVENTS\s*=/.test(content)) {
            indexEventsFile(fullPath);
          }
        }
      }
    }
  }

  for (const dir of SOURCE_DIRS) {
    walkDir(dir);
  }

  if (verbose) {
    console.log(`Indexed ${exportedFunctions.size} functions`);
    console.log(`Indexed ${exportedMethods.size} classes`);
    console.log(`Indexed ${definedEvents.size} events`);
  }
}

// ============================================================================
// Documentation Scanning (remark AST + incremental cache)
// ============================================================================

// Skip these common patterns that aren't actual code references
const SKIP_FUNCTIONS = new Set([
  // Common English words that look like functions
  'eg', 'ie', 'etc', 'and', 'or', 'if', 'for', 'while', 'return',
  // Ink language constructs
  'INCLUDE', 'VAR', 'CONST', 'LIST', 'function',
  // Generic placeholders in docs
  'functionName', 'methodName', 'eventName', 'componentName',
  'name', 'value', 'data', 'result', 'callback', 'handler',
  // Common JS/TS patterns
  'constructor', 'async', 'await', 'then', 'catch', 'finally',
  'map', 'filter', 'reduce', 'find', 'some', 'every', 'forEach',
  'push', 'pop', 'shift', 'unshift', 'slice', 'splice',
  'get', 'set', 'delete', 'has', 'clear', 'add', 'remove',
  'log', 'warn', 'error', 'info', 'debug',
  'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
  // Test framework
  'test', 'describe', 'it', 'expect', 'beforeEach', 'afterEach',
  'beforeAll', 'afterAll', 'skip', 'only',
  // CSS functions (appear in inline code in docs)
  'var', 'rgba', 'rgb', 'hsl', 'calc', 'url', 'attr',
  // DOM built-ins
  'attachShadow', 'connectedCallback', 'disconnectedCallback',
  'attributeChangedCallback', 'adoptedCallback',
]);

// Docs allowed to reference example/placeholder names
// These are API reference docs that DEFINE the API (not just reference it)
const REFERENCE_DOC_PATTERNS = [
  /inkjs-features\.md$/,
  /component-api\.md$/,
  /system-api\.md$/,
  /conversation-system\.md$/,
  /analytics\.md$/,
  /reference\/cqo\.md$/,
  /reference\/toml-schema\.md$/,
  /reference\/testing\.md$/,
  /reference\/debug-panel\.md$/,
  /reference\/qa-tools\.md$/,
  /BUG-HISTORY\.md$/,
];

/**
 * Check if a method name is a built-in JS method
 */
function isBuiltInMethod(name) {
  const builtIns = new Set([
    // Array methods
    'map', 'filter', 'reduce', 'find', 'some', 'every', 'forEach',
    'push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'concat',
    'indexOf', 'includes', 'join', 'sort', 'reverse', 'flat', 'flatMap',
    // String methods
    'trim', 'split', 'replace', 'match', 'substring', 'toLowerCase', 'toUpperCase',
    'startsWith', 'endsWith', 'padStart', 'padEnd', 'repeat',
    // Object methods
    'keys', 'values', 'entries', 'assign', 'freeze', 'seal',
    // Promise methods
    'then', 'catch', 'finally', 'resolve', 'reject', 'all', 'race',
    // DOM methods
    'querySelector', 'querySelectorAll', 'getElementById', 'createElement',
    'appendChild', 'removeChild', 'addEventListener', 'removeEventListener',
    'dispatchEvent', 'setAttribute', 'getAttribute', 'classList', 'style',
    // Console
    'log', 'warn', 'error', 'info', 'debug', 'trace',
    // JSON
    'parse', 'stringify',
    // Math
    'floor', 'ceil', 'round', 'random', 'max', 'min', 'abs',
    // Common patterns
    'toString', 'valueOf', 'toJSON', 'toLocaleString',
    // i18n
    't', 'getName',
    // Navigation
    'goto',
    // Iteration
    'first', 'at', 'next', 'last',
  ]);

  return builtIns.has(name);
}

// ============================================================================
// Cache
// ============================================================================

const CACHE_DIR = 'node_modules/.cache/lint-doc-code-refs';
const CACHE_FILE = join(CACHE_DIR, 'cache.json');

function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return { docs: {} };
  }
}

function saveCache(cache) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ============================================================================
// AST-based ref extraction
// ============================================================================

/**
 * Extract code references from a markdown file's inlineCode nodes.
 * Returns array of { type, name, line, context }.
 */
function extractRefs(content) {
  const tree = parseMarkdown(content);
  const refs = [];

  visitNodes(tree, ['inlineCode'], (node) => {
    const value = node.value;
    const line = node.position?.start?.line ?? 0;

    // Pattern 1: functionName() or functionName(args)
    const funcMatch = value.match(/^(\w+)\s*\([^)]*\)$/);
    if (funcMatch) {
      refs.push({ type: 'function', name: funcMatch[1], line, context: value });
    }

    // Pattern 2: .methodName( — inline code containing a method call
    const methodMatches = value.matchAll(/\.(\w+)\s*\(/g);
    for (const m of methodMatches) {
      refs.push({ type: 'method', name: m[1], line, context: value });
    }

    // Pattern 3: EVENTS.NAME
    const eventConstMatches = value.matchAll(/(\w*EVENTS)\.(\w+)/g);
    for (const m of eventConstMatches) {
      refs.push({ type: 'event', name: m[2], line, context: value, namespace: m[1] });
    }

    // Pattern 4: event string literals in event-related context
    const eventStrMatches = value.matchAll(/'([\w-]+)'\s*(?:event|Event)|\b(?:emit|on|listen)\s*\(\s*'([\w-]+)'/g);
    for (const m of eventStrMatches) {
      const evtName = m[1] || m[2];
      if (evtName) {
        refs.push({ type: 'event', name: evtName, line, context: value });
      }
    }
  });

  return refs;
}

// ============================================================================
// Find markdown files
// ============================================================================

function findMarkdownFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

// ============================================================================
// Main
// ============================================================================

console.log('CQO-26: Checking doc-code consistency...\n');

// Build code index first
console.log('Building code index...');
buildCodeIndex();
console.log('');

// Collect doc files
const allFiles = DOC_DIRS.flatMap(dir => findMarkdownFiles(dir));
console.log(`Checking ${allFiles.length} documentation file(s)...`);

// Load cache & build manifest of current docs
const cache = loadCache();
const currentPaths = new Set(allFiles.map(f => relative(process.cwd(), f)));

// Evict removed docs
for (const cached of Object.keys(cache.docs)) {
  if (!currentPaths.has(cached)) {
    if (verbose) console.log(`  evict  ${cached}`);
    delete cache.docs[cached];
  }
}

// Parse changed docs, reuse cached refs for unchanged
/** @type {Map<string, { refs: Array<{type:string, name:string, line:number, context:string, namespace?:string}> }>} */
const docRefs = new Map();

for (const file of allFiles) {
  const relPath = relative(process.cwd(), file);
  const content = readFileSync(file, 'utf-8');
  const hash = contentHash(content);

  if (cache.docs[relPath]?.hash === hash) {
    // Cache hit — reuse refs
    docRefs.set(relPath, cache.docs[relPath].refs);
    if (verbose) console.log(`  cached ${relPath}`);
  } else {
    // Parse fresh
    const refs = extractRefs(content);
    cache.docs[relPath] = { hash, refs };
    docRefs.set(relPath, refs);
    if (verbose) console.log(`  parsed ${relPath} (${refs.length} refs)`);
  }
}

// Save updated cache
saveCache(cache);

// Validate all refs against fresh code index
const violations = [];

for (const [relPath, refs] of docRefs) {
  const isReferenceDoc = REFERENCE_DOC_PATTERNS.some(p => p.test(relPath));
  if (isReferenceDoc) continue;

  for (const ref of refs) {
    if (ref.type === 'function') {
      if (SKIP_FUNCTIONS.has(ref.name)) continue;
      if (exportedFunctions.has(ref.name)) continue;
      if (DOCUMENTED_INTERNALS.has(ref.name)) continue;
      let isMethod = false;
      for (const methods of exportedMethods.values()) {
        if (methods.has(ref.name)) { isMethod = true; break; }
      }
      if (isMethod) continue;

      violations.push({ file: relPath, line: ref.line, type: 'function', reference: ref.name, context: ref.context });
    } else if (ref.type === 'method') {
      if (SKIP_FUNCTIONS.has(ref.name)) continue;
      if (isBuiltInMethod(ref.name)) continue;
      let methodExists = false;
      for (const methods of exportedMethods.values()) {
        if (methods.has(ref.name)) { methodExists = true; break; }
      }
      if (methodExists) continue;

      violations.push({ file: relPath, line: ref.line, type: 'method', reference: ref.name, context: ref.context });
    } else if (ref.type === 'event') {
      if (definedEvents.has(ref.name)) continue;
      const display = ref.namespace ? `${ref.namespace}.${ref.name}` : ref.name;
      violations.push({ file: relPath, line: ref.line, type: 'event', reference: display, context: ref.context });
    }
  }
}

console.log('');

if (violations.length > 0) {
  console.error('CQO-26 violations (stale code references in docs):\n');

  // Group by type for clarity
  const byType = { function: [], method: [], event: [] };
  for (const v of violations) {
    byType[v.type].push(v);
  }

  for (const [type, viols] of Object.entries(byType)) {
    if (viols.length === 0) continue;

    console.error(`  ${type.toUpperCase()} references:\n`);
    for (const v of viols) {
      console.error(`    ${v.file}:${v.line}`);
      console.error(`      Reference: ${v.reference}`);
      console.error(`      Context: ${v.context}`);
      console.error('');
    }
  }

  console.error(`Found ${violations.length} stale reference(s)\n`);
  console.error('Fix by:');
  console.error('  1. Updating doc to use new function/method/event name');
  console.error('  2. Removing doc reference if feature was deleted');
  console.error('  3. Adding missing export if code exists but not exported');
  process.exit(1);
}

console.log(`✓ CQO-26: All doc references match code`);
process.exit(0);
