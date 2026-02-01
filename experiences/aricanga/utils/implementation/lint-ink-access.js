#!/usr/bin/env node
/**
 * lint-ink-access.js - Enforce typed InkBridge accessors
 * CQO-15: All ink variable reads must go through typed accessor methods
 * 
 * USAGE
 *   node utils/linting/lint-ink-access.js [options]
 * 
 * OPTIONS
 *   --help, -h     Show help
 *   --verbose, -v  Show all files checked
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// 4-layer architecture: ink access primarily in implementations
// Dynamically discover all implementation directories
function getImplementationDirs() {
  const implRoot = 'implementations';
  if (!existsSync(implRoot)) return [];
  return readdirSync(implRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(implRoot, d.name, 'src'));
}

const JS_DIRS = [
  ...getImplementationDirs(),
  'packages/framework/src/systems',
];

// Files that are allowed to access story.variablesState directly
const ALLOWED_FILES = new Set([
  'ink-bridge.js',  // The bridge itself defines accessors
  'game-state.js',  // XState machine needs low-level access for some operations
]);

// Patterns that indicate direct variablesState access
const FORBIDDEN_PATTERNS = [
  // Direct property access: story.variablesState.foo or story.variablesState['foo']
  /(?:story|this\.story)\.variablesState\s*[\.\[]/g,
  // Assignment to variablesState
  /(?:story|this\.story)\.variablesState\s*\.\s*\w+\s*=/g,
];

// Patterns that are exceptions (allowed even outside bridge)
const EXCEPTION_PATTERNS = [
  // Null checks are OK
  /story\.variablesState\s*[?!]?\s*$/,
  /story\?\.variablesState\s*$/,
  // Type checking is OK
  /typeof\s+.*variablesState/,
];

const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const showHelp = args.includes('-h') || args.includes('--help');

if (showHelp) {
  console.log(`
lint-ink-access.js - Enforce typed InkBridge accessors

CQO-15: All ink variable reads must go through typed accessor methods on InkBridge.
Direct story.variablesState access is forbidden outside of ink-bridge.js.

USAGE
  node utils/linting/lint-ink-access.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all files checked

VALID PATTERNS (using InkBridge)
  const money = this.inkBridge.getVariableNumber('current_money');
  const chat = this.inkBridge.getVariableString('current_chat');
  const flag = this.inkBridge.getVariableBoolean('has_seen_intro');

INVALID PATTERNS (direct access)
  const money = this.story.variablesState.current_money;
  const chat = story.variablesState['current_chat'];
  this.story.variablesState.some_flag = true;

ALLOWED FILES
  ink-bridge.js   - Defines the typed accessors
  game-state.js   - XState needs some low-level access (with caution)

EXIT CODES
  0  No violations found
  1  Direct variablesState access detected
`);
  process.exit(0);
}

const errors = [];
let filesChecked = 0;

function isException(line) {
  for (const pattern of EXCEPTION_PATTERNS) {
    if (pattern.test(line)) {
      return true;
    }
  }
  return false;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = filePath.split('/').pop();
  
  // Skip allowed files
  if (ALLOWED_FILES.has(fileName)) {
    if (verbose) console.log(`  [skip] ${filePath} (allowed file)`);
    return;
  }
  
  // Skip if file doesn't reference variablesState
  if (!content.includes('variablesState')) {
    if (verbose) console.log(`  [skip] ${filePath} (no variablesState)`);
    return;
  }
  
  filesChecked++;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    
    // Skip lines marked as allowed
    if (line.includes('// allowed') || line.includes('// CQO-15 exception')) continue;
    
    // Check each forbidden pattern
    for (const pattern of FORBIDDEN_PATTERNS) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      
      if (pattern.test(line) && !isException(line)) {
        // Extract the specific access for context
        const accessMatch = line.match(/variablesState[\.\[][\w'"]+/);
        const accessedVar = accessMatch ? accessMatch[0] : 'variablesState';
        
        errors.push({
          file: relative(process.cwd(), filePath),
          line: lineNum,
          code: trimmed.substring(0, 80) + (trimmed.length > 80 ? '...' : ''),
          accessedVar,
        });
        break; // Only report once per line
      }
    }
  }
}

function findJsFiles(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...findJsFiles(fullPath));
      } else if (entry.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

console.log(`Checking ink variable access in ${JS_DIRS.join(', ')}...`);
if (verbose) console.log('');

const jsFiles = JS_DIRS.flatMap(dir => findJsFiles(dir));
for (const file of jsFiles) {
  checkFile(file);
}

console.log('');
if (errors.length > 0) {
  console.error('CQO-15 violations found:\n');
  for (const err of errors) {
    console.error(`  ${err.file}:${err.line}`);
    console.error(`    Access: ${err.accessedVar}`);
    console.error(`    Code: ${err.code}`);
    console.error('');
  }
  console.error(`Found ${errors.length} direct variablesState access(es)`);
  console.error('');
  console.error('To fix:');
  console.error('  1. Use InkBridge typed accessors instead:');
  console.error('     - inkBridge.getVariableString(name)');
  console.error('     - inkBridge.getVariableNumber(name)');
  console.error('     - inkBridge.getVariableBoolean(name)');
  console.error('  2. If this access is intentional, add "// CQO-15 exception" comment');
  process.exit(1);
} else {
  console.log(`✓ CQO-15: All ink access uses typed accessors`);
  if (verbose) console.log(`  Checked ${filesChecked} file(s)`);
  process.exit(0);
}
