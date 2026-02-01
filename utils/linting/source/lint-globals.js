#!/usr/bin/env node
/**
 * lint-globals.js - Static check for undeclared window globals
 * CQO-12: Explicit Dependencies
 * 
 * This is a lightweight static analysis that runs in the Stop hook.
 * The full runtime check is in packages/tests/quality/globals.spec.ts
 * 
 * USAGE
 *   node utils/linting/lint-globals.js [options]
 * 
 * OPTIONS
 *   --help, -h     Show this help message
 *   --verbose, -v  Show all files checked
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// 4-layer architecture directories
const JS_DIRS = [
  'packages/framework/src/foundation',
  'packages/framework/src/systems',
  'implementations',
];

// Globals that are explicitly allowed in the project
const ALLOWED_GLOBALS = new Set([
  'controller',   // Debug access to game controller
  'inkjs',        // ink runtime (loaded via script tag)
  'gameHub',      // Debug access to hub component
  'gameThread',   // Debug access to thread component
]);

// Files that are allowed to set globals (bootstrap/entry points)
const BOOTSTRAP_FILES = new Set([
  'main.js',
]);

// Patterns that indicate global assignment
const GLOBAL_PATTERNS = [
  // window.foo = ...
  /window\.(\w+)\s*=/g,
  // globalThis.foo = ...
  /globalThis\.(\w+)\s*=/g,
];

const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const showHelp = args.includes('-h') || args.includes('--help');

if (showHelp) {
  console.log(`
lint-globals.js - Static check for undeclared window globals

CQO-12: All globals must be explicitly declared in ALLOWED_GLOBALS.

USAGE
  node utils/linting/lint-globals.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all files checked

ALLOWED GLOBALS
  ${[...ALLOWED_GLOBALS].join(', ')}

BOOTSTRAP FILES (can set any global)
  ${[...BOOTSTRAP_FILES].join(', ')}

EXIT CODES
  0  No violations found
  1  Undeclared globals detected
`);
  process.exit(0);
}

const errors = [];
let filesChecked = 0;

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = filePath.split('/').pop();
  
  // Bootstrap files can set any global
  if (BOOTSTRAP_FILES.has(fileName)) {
    if (verbose) console.log(`  [skip] ${filePath} (bootstrap)`);
    return;
  }
  
  // Skip generated files
  if (filePath.includes('/generated/')) {
    if (verbose) console.log(`  [skip] ${filePath} (generated)`);
    return;
  }
  
  filesChecked++;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    
    // Skip lines with "// allowed" comment
    if (line.includes('// allowed')) continue;
    
    for (const pattern of GLOBAL_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const globalName = match[1];
        
        if (!ALLOWED_GLOBALS.has(globalName)) {
          errors.push({
            file: relative(process.cwd(), filePath),
            line: lineNum,
            global: globalName,
            code: line.trim().substring(0, 60),
          });
        } else if (verbose) {
          console.log(`  [ok] ${filePath}:${lineNum} - ${globalName} (allowed)`);
        }
      }
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

console.log(`Checking global assignments in ${JS_DIRS.join(', ')}...`);
if (verbose) console.log('');

const jsFiles = JS_DIRS.flatMap(dir => findJsFiles(dir));
for (const file of jsFiles) {
  checkFile(file);
}

console.log('');
if (errors.length > 0) {
  console.error('CQO-12 violations found:\n');
  for (const err of errors) {
    console.error(`  ${err.file}:${err.line}`);
    console.error(`    Global: window.${err.global}`);
    console.error(`    Code: ${err.code}`);
    console.error('');
  }
  console.error(`Found ${errors.length} undeclared global(s)`);
  console.error('');
  console.error('To fix:');
  console.error('  1. Remove the global assignment, OR');
  console.error('  2. Add to ALLOWED_GLOBALS in lint-globals.js and globals.spec.ts');
  console.error('  3. Add "// allowed" comment if intentional');
  process.exit(1);
} else {
  console.log(`✓ CQO-12: No undeclared globals`);
  if (verbose) console.log(`  Checked ${filesChecked} file(s)`);
  process.exit(0);
}
