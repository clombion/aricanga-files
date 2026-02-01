#!/usr/bin/env node
/**
 * lint-action-guards.js - Check for guard clauses in XState actions
 * CQO-16: XState actions should validate context before use
 * 
 * This is a WARNING-level check (exit 0 even on findings).
 * It identifies actions that access context without guards.
 * 
 * USAGE
 *   node utils/linting/lint-action-guards.js [options]
 * 
 * OPTIONS
 *   --help, -h     Show help
 *   --verbose, -v  Show all actions checked
 *   --strict       Exit 1 on findings (default: exit 0 with warnings)
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// 4-layer architecture: game-state is in implementations
// Dynamically discover all game-state.js files across implementations
function getStateFiles() {
  const implRoot = 'implementations';
  if (!existsSync(implRoot)) return [];
  return readdirSync(implRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(implRoot, d.name, 'src', 'game-state.js'))
    .filter(f => existsSync(f));
}

const STATE_FILES = getStateFiles();

// Context properties that should be validated before use
const CRITICAL_CONTEXT_PROPS = [
  'story',
  'currentView',
  'messageHistory',
  'targetChatId',
];

// Patterns that indicate context access without guards
const RISKY_PATTERNS = [
  // Direct property access that could fail on null
  /context\.story\.\w+/,
  /context\.currentView\.\w+/,
  /context\.messageHistory\[\w+\]/,
];

// Patterns that indicate proper guards
const GUARD_PATTERNS = [
  /if\s*\(\s*!?\s*context\.\w+/,        // if (context.foo) or if (!context.foo)
  /context\.\w+\s*[?!]/,                 // optional chaining or assertion
  /context\.\w+\s*\|\|/,                 // fallback
  /context\.\w+\s*\?\?/,                 // nullish coalescing
  /guard.*context/i,                     // XState guard reference
];

const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const strict = args.includes('--strict');
const showHelp = args.includes('-h') || args.includes('--help');

if (showHelp) {
  console.log(`
lint-action-guards.js - Check for guard clauses in XState actions

CQO-16: XState actions that read from context should validate required fields.

USAGE
  node utils/linting/lint-action-guards.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all actions checked
  --strict       Exit 1 on findings (default: exit 0)

RECOMMENDED PATTERN
  processStoryChunk: assign(({ context }) => {
    // Guard clause - validate before use
    if (!context.story?.canContinue) return context;
    
    // Safe to proceed
    const text = context.story.Continue();
    ...
  })

RISKY PATTERN (no guard)
  updateChat: assign(({ context }) => {
    // Direct access without validation
    const chat = context.currentView.chatId;  // Might be null!
    ...
  })

EXIT CODES
  0  No issues (or issues found in non-strict mode)
  1  Issues found (strict mode only)
`);
  process.exit(0);
}

const warnings = [];

function analyzeAction(actionName, actionBody, startLine) {
  const lines = actionBody.split('\n');
  const issues = [];
  
  // Check each line for risky patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = startLine + i;
    
    // Skip comments
    if (line.trim().startsWith('//')) continue;
    
    // Check for risky context access
    for (const pattern of RISKY_PATTERNS) {
      if (pattern.test(line)) {
        // Check if there's a guard before this line
        const precedingCode = lines.slice(0, i).join('\n');
        const hasGuard = GUARD_PATTERNS.some(g => g.test(precedingCode));
        
        // Check if this line itself has defensive coding
        const lineHasDefense = 
          line.includes('?.') ||
          line.includes('||') ||
          line.includes('??') ||
          line.includes('if (');
        
        if (!hasGuard && !lineHasDefense) {
          issues.push({
            line: lineNum,
            code: line.trim().substring(0, 60),
            suggestion: 'Add guard clause or optional chaining',
          });
        }
      }
    }
  }
  
  return issues;
}

function checkFile(stateFile) {
  let content;
  try {
    content = readFileSync(stateFile, 'utf-8');
  } catch {
    if (verbose) console.log(`File not found: ${stateFile}`);
    return;
  }

  const lines = content.split('\n');

  // Find action definitions
  // Pattern: actionName: assign(({ context }) => { ... })
  // or actionName: assign({ prop: ... })
  const actionRegex = /(\w+):\s*assign\s*\(\s*(?:\(\s*\{\s*context[^}]*\}\s*\)\s*=>|{)/g;

  let match;
  while ((match = actionRegex.exec(content)) !== null) {
    const actionName = match[1];
    const startPos = match.index;

    // Find the line number
    const beforeMatch = content.substring(0, startPos);
    const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;

    // Extract the action body (simplified - find matching braces)
    let braceCount = 0;
    let inAction = false;
    let actionEnd = startPos;

    for (let i = startPos; i < content.length; i++) {
      const char = content[i];
      if (char === '{') {
        braceCount++;
        inAction = true;
      } else if (char === '}') {
        braceCount--;
        if (inAction && braceCount === 0) {
          actionEnd = i;
          break;
        }
      }
    }

    const actionBody = content.substring(startPos, actionEnd);

    if (verbose) {
      console.log(`  Checking action: ${actionName} (line ${lineNum})`);
    }

    const issues = analyzeAction(actionName, actionBody, lineNum);

    if (issues.length > 0) {
      warnings.push({
        action: actionName,
        file: stateFile,
        issues,
      });
    }
  }
}

if (STATE_FILES.length === 0) {
  console.log('No game-state.js files found in experiences/');
  process.exit(0);
}

console.log(`Checking XState action guards in ${STATE_FILES.length} file(s)...`);
if (verbose) console.log(`  Files: ${STATE_FILES.join(', ')}`);
if (verbose) console.log('');

for (const stateFile of STATE_FILES) {
  checkFile(stateFile);
}

console.log('');
if (warnings.length > 0) {
  console.warn('CQO-16 suggestions:\n');
  for (const warn of warnings) {
    console.warn(`  Action: ${warn.action}`);
    for (const issue of warn.issues) {
      console.warn(`    Line ${issue.line}: ${issue.code}`);
      console.warn(`    → ${issue.suggestion}`);
    }
    console.warn('');
  }
  console.warn(`Found ${warnings.length} action(s) that may need guards`);
  console.warn('');
  console.warn('Recommended pattern:');
  console.warn('  if (!context.story?.canContinue) return context;');
  console.warn('  // or use optional chaining: context.story?.variablesState');
  
  if (strict) {
    process.exit(1);
  } else {
    console.warn('\n(Run with --strict to fail on these findings)');
    process.exit(0);
  }
} else {
  console.log(`✓ CQO-16: XState actions have appropriate guards`);
  process.exit(0);
}
