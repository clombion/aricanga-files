#!/usr/bin/env node
/**
 * lint-test-skips.js - Ensure test skips have documented rationale
 * CQO-19: No Naive Test Skips
 *
 * Test skips must reference a backlog task or have clear rationale.
 * Skipping tests as a lazy workaround is forbidden.
 *
 * Usage: node utils/linting/source/lint-test-skips.js [--strict]
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// Monorepo test locations
const TEST_DIRS = [
  'tests',
  'packages/framework/tests',
  'packages/test-utils',
  'experiences/aricanga/tests',
];

const SKIP_PATTERNS = [
  /(?:test|it|describe)\.skip\s*\(/,
  /\.skip\(\s*['"`]/,
];

// Valid skip comment must appear on line before skip
const VALID_SKIP_COMMENT = /\/\/\s*Skip:\s*\S+/i;
const TASK_REFERENCE = /task-\d+/i;

const args = process.argv.slice(2);
const strict = args.includes('--strict');

const errors = [];
let filesChecked = 0;
let skipsFound = 0;

function findTestFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  
  function walk(d) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.name.endsWith('.test.ts') ||
        entry.name.endsWith('.test.js') ||
        entry.name.endsWith('.spec.ts') ||
        entry.name.endsWith('.spec.js')
      ) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = relative(process.cwd(), filePath);
  
  const hasSkip = SKIP_PATTERNS.some(p => p.test(content));
  if (!hasSkip) return;
  
  filesChecked++;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    const hasSkipOnLine = SKIP_PATTERNS.some(p => p.test(line));
    if (!hasSkipOnLine) continue;
    
    skipsFound++;
    
    const prevLine = i > 0 ? lines[i - 1] : '';
    const prevPrevLine = i > 1 ? lines[i - 2] : '';
    
    const hasValidComment = 
      VALID_SKIP_COMMENT.test(prevLine) || 
      VALID_SKIP_COMMENT.test(prevPrevLine);
    
    const hasTaskRef = 
      TASK_REFERENCE.test(prevLine) || 
      TASK_REFERENCE.test(prevPrevLine) ||
      TASK_REFERENCE.test(line);
    
    if (!hasValidComment) {
      errors.push({
        file: relativePath,
        line: lineNum,
        code: line.trim().substring(0, 70),
        issue: 'Skip without "// Skip:" comment',
      });
    } else if (strict && !hasTaskRef) {
      errors.push({
        file: relativePath,
        line: lineNum,
        code: line.trim().substring(0, 70),
        issue: 'Skip lacks task reference (strict mode)',
      });
    }
  }
}

console.log('CQO-19: Checking test skips...\n');

for (const dir of TEST_DIRS) {
  const files = findTestFiles(dir);
  for (const file of files) {
    checkFile(file);
  }
}

console.log(`Found ${skipsFound} skip(s) in ${filesChecked} file(s)\n`);

if (errors.length > 0) {
  console.error('Violations found:\n');
  for (const err of errors) {
    console.error(`  ${err.file}:${err.line}`);
    console.error(`    ${err.code}`);
    console.error(`    → ${err.issue}\n`);
  }
  console.error(`Fix by adding: // Skip: task-XXX - rationale\n`);
  process.exit(1);
}

console.log('✓ CQO-19: All test skips documented');
process.exit(0);
