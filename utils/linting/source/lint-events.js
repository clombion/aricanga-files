#!/usr/bin/env node
/**
 * lint-events.js - Enforce event factory usage
 * CQO-14: All eventBus.emit() calls must use factory functions
 * 
 * USAGE
 *   node utils/linting/lint-events.js [options]
 * 
 * OPTIONS
 *   --help, -h     Show help
 *   --verbose, -v  Show all files checked
 *   --fix          Show suggested fixes
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// 4-layer architecture directories
const JS_DIRS = [
  'packages/framework/src/foundation',
  'packages/framework/src/systems',
  'implementations',
];

// Files that define event factories (allowed to construct payloads)
const FACTORY_FILES = new Set([
  'factories.js',  // src/systems/conversation/events/factories.js
]);

// Known factory function names (from event-factories.js)
const FACTORY_FUNCTIONS = new Set([
  'createMessageEvent',
  'createNotificationEvent',
  'createTypingStartEvent',
  'createTypingEndEvent',
  'createPresenceEvent',
  'createTimeEvent',
  'createBatteryEvent',
  'createChatOpenedEvent',
  'createChoicesEvent',
  'createDataRequestEvent',
  'createDataResponseEvent',
  'createDataErrorEvent',
  'createThemeChangedEvent',
]);

// Pattern to detect eventBus.emit calls
const EMIT_PATTERN = /eventBus\.emit\s*\(\s*([^,]+),\s*(\{[\s\S]*?\}|\w+)/g;

// Pattern to detect inline object literals (not factory calls)
const INLINE_OBJECT_PATTERN = /^\s*\{/;

const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const showFix = args.includes('--fix');
const showHelp = args.includes('-h') || args.includes('--help');

if (showHelp) {
  console.log(`
lint-events.js - Enforce event factory usage

CQO-14: All eventBus.emit() calls must use factory functions from event-factories.js.
No inline object literals allowed.

USAGE
  node utils/linting/lint-events.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all files checked
  --fix          Show suggested factory function to use

VALID PATTERNS
  eventBus.emit(OS_EVENTS.MESSAGE_RECEIVED, createMessageEvent(chatId, msg));
  eventBus.emit(OS_EVENTS.NOTIFICATION_SHOW, createNotificationEvent(chatId, preview));

INVALID PATTERNS
  eventBus.emit(OS_EVENTS.MESSAGE_RECEIVED, { chatId, message });
  eventBus.emit(OS_EVENTS.NOTIFICATION_SHOW, { chatId, preview: text });

EXIT CODES
  0  No violations found
  1  Event factory violations detected
`);
  process.exit(0);
}

const errors = [];
let filesChecked = 0;

// Map event names to their factory functions
const EVENT_TO_FACTORY = {
  'MESSAGE_RECEIVED': 'createMessageEvent',
  'MESSAGE_SENT': 'createMessageEvent',
  'NOTIFICATION_SHOW': 'createNotificationEvent',
  'TYPING_START': 'createTypingStartEvent',
  'TYPING_END': 'createTypingEndEvent',
  'PRESENCE_CHANGED': 'createPresenceEvent',
  'TIME_UPDATED': 'createTimeEvent',
  'BATTERY_CHANGED': 'createBatteryEvent',
  'CHAT_OPENED': 'createChatOpenedEvent',
  'CHOICES_AVAILABLE': 'createChoicesEvent',
  'DATA_REQUESTED': 'createDataRequestEvent',
  'DATA_RECEIVED': 'createDataResponseEvent',
  'DATA_ERROR': 'createDataErrorEvent',
  'THEME_CHANGED': 'createThemeChangedEvent',
};

function extractEventName(eventExpr) {
  // Extract event name from expressions like OS_EVENTS.MESSAGE_RECEIVED
  const match = eventExpr.match(/\.(\w+)$/);
  return match ? match[1] : null;
}

function isFactoryCall(payloadExpr) {
  // Check if the payload is a factory function call
  const trimmed = payloadExpr.trim();
  
  // Check if it starts with a known factory function
  for (const factory of FACTORY_FUNCTIONS) {
    if (trimmed.startsWith(factory + '(') || trimmed.startsWith(factory + ' (')) {
      return true;
    }
  }
  
  // Check if it's a variable (not inline object)
  if (!INLINE_OBJECT_PATTERN.test(trimmed)) {
    // Could be a variable holding a factory result - allow it
    // This catches cases like: const event = createMessageEvent(...); emit(X, event);
    return true;
  }
  
  return false;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = filePath.split('/').pop();
  
  // Skip factory definition file
  if (FACTORY_FILES.has(fileName)) {
    if (verbose) console.log(`  [skip] ${filePath} (factory definition)`);
    return;
  }
  
  // Skip if file doesn't use eventBus
  if (!content.includes('eventBus.emit')) {
    if (verbose) console.log(`  [skip] ${filePath} (no eventBus.emit)`);
    return;
  }
  
  filesChecked++;
  
  // Check for eventBus.emit with inline objects
  // We need to handle multi-line emit calls
  const fullContent = content.replace(/\n/g, ' ');
  
  let match;
  const emitRegex = /eventBus\.emit\s*\(\s*([^,]+),\s*(\{[^}]+\}|[^)]+)\)/g;
  
  while ((match = emitRegex.exec(fullContent)) !== null) {
    const eventExpr = match[1].trim();
    const payloadExpr = match[2].trim();
    
    // Find the line number
    const beforeMatch = content.substring(0, content.indexOf(match[0]));
    const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
    
    if (!isFactoryCall(payloadExpr)) {
      const eventName = extractEventName(eventExpr);
      const suggestedFactory = EVENT_TO_FACTORY[eventName] || 'create<Event>Event';
      
      errors.push({
        file: relative(process.cwd(), filePath),
        line: lineNum,
        event: eventExpr,
        payload: payloadExpr.substring(0, 50) + (payloadExpr.length > 50 ? '...' : ''),
        suggestion: suggestedFactory,
      });
    } else if (verbose) {
      console.log(`  [ok] ${filePath}:${lineNum} - uses factory`);
    }
  }
}

const SKIP_DIRS = ['node_modules', 'vendor', 'dist', 'generated', 'data', 'ink', 'css', 'assets'];

function findJsFiles(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name) || entry.name.startsWith('.')) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findJsFiles(fullPath));
      } else if (entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

console.log(`Checking event factory usage in ${JS_DIRS.join(', ')}...`);
if (verbose) console.log('');

const jsFiles = JS_DIRS.flatMap(dir => findJsFiles(dir));
for (const file of jsFiles) {
  checkFile(file);
}

console.log('');
if (errors.length > 0) {
  console.error('CQO-14 violations found:\n');
  for (const err of errors) {
    console.error(`  ${err.file}:${err.line}`);
    console.error(`    Event: ${err.event}`);
    console.error(`    Payload: ${err.payload}`);
    if (showFix) {
      console.error(`    Suggestion: Use ${err.suggestion}() instead of inline object`);
    }
    console.error('');
  }
  console.error(`Found ${errors.length} inline event payload(s)`);
  console.error('');
  console.error('To fix:');
  console.error('  1. Import the appropriate factory from event-factories.js');
  console.error('  2. Replace inline object with factory call');
  console.error('  3. If no factory exists, add one to event-factories.js first');
  process.exit(1);
} else {
  console.log(`✓ CQO-14: All eventBus.emit calls use factories`);
  if (verbose) console.log(`  Checked ${filesChecked} file(s)`);
  process.exit(0);
}
