#!/usr/bin/env node
/**
 * lint-component-params.js - Check component method parameter validation
 * CQO-17: Public component methods should validate parameters
 * 
 * This is a WARNING-level check that identifies public methods
 * that accept parameters without validation.
 * 
 * USAGE
 *   node utils/linting/lint-component-params.js [options]
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// 4-layer architecture: components in systems and all implementations
// Dynamically discover all implementation component directories
function getComponentDirs() {
  const dirs = ['packages/framework/src/systems/conversation/components'];
  const implRoot = 'implementations';
  if (existsSync(implRoot)) {
    const impls = readdirSync(implRoot, { withFileTypes: true })
      .filter(d => d.isDirectory());
    for (const impl of impls) {
      const compDir = join(implRoot, impl.name, 'src', 'components');
      if (existsSync(compDir)) {
        dirs.push(compDir);
      }
    }
  }
  return dirs;
}

const COMPONENTS_DIRS = getComponentDirs();

// Public methods that typically need parameter validation
const PUBLIC_METHODS = [
  'open',
  'close', 
  'init',
  'update',
  'setData',
  'render',
  'add',
  'remove',
  'set',
];

// Validation patterns we look for
const VALIDATION_PATTERNS = [
  /if\s*\(\s*![\w.]+\s*\)/,           // if (!param)
  /if\s*\(\s*[\w.]+\s*===/,           // if (param === ...)
  /throw\s+new\s+Error/,               // throw new Error
  /console\.(error|warn)/,             // console.error/warn
  /Array\.isArray/,                    // Array.isArray check
  /typeof\s+\w+/,                      // typeof check
  /\?\?/,                              // nullish coalescing
  /\|\|/,                              // OR fallback
];

const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const showHelp = args.includes('-h') || args.includes('--help');

if (showHelp) {
  console.log(`
lint-component-params.js - Check component method parameter validation

CQO-17: Public component methods should validate parameters to fail fast.

USAGE
  node utils/linting/lint-component-params.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all methods checked

RECOMMENDED PATTERN
  open(chatId, title, messages) {
    // Fail fast with clear error
    if (!chatId) throw new Error('ChatThread.open: missing chatId');
    
    // Safe defaults for optional params
    this.messages = Array.isArray(messages) ? messages : [];
    
    // Proceed with logic
    ...
  }

EXIT CODES
  0  Always (this is advisory only)
`);
  process.exit(0);
}

const suggestions = [];

function analyzeMethod(methodName, methodBody, fileName, lineNum) {
  // Check if method has parameters
  const paramsMatch = methodBody.match(/^\s*\w+\s*\(([^)]*)\)/);
  if (!paramsMatch) return null;
  
  const params = paramsMatch[1].split(',').map(p => p.trim()).filter(p => p);
  if (params.length === 0) return null;
  
  // Check first 5 lines for validation
  const firstLines = methodBody.split('\n').slice(0, 8).join('\n');
  
  const hasValidation = VALIDATION_PATTERNS.some(pattern => pattern.test(firstLines));
  
  if (!hasValidation && params.length > 0) {
    return {
      method: methodName,
      params: params.map(p => p.split('=')[0].trim()), // Remove defaults
      file: fileName,
      line: lineNum,
    };
  }
  
  return null;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const fileName = filePath.split('/').pop();
  const lines = content.split('\n');
  
  // Find method definitions
  for (const methodName of PUBLIC_METHODS) {
    // Pattern: methodName(params) { or methodName = (params) => {
    const methodRegex = new RegExp(`(${methodName})\\s*\\([^)]*\\)\\s*\\{`, 'g');
    
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      const startPos = match.index;
      const lineNum = (content.substring(0, startPos).match(/\n/g) || []).length + 1;
      
      // Extract method body
      let braceCount = 0;
      let methodEnd = startPos;
      
      for (let i = startPos; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        else if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            methodEnd = i;
            break;
          }
        }
      }
      
      const methodBody = content.substring(startPos, methodEnd);
      const suggestion = analyzeMethod(methodName, methodBody, fileName, lineNum);
      
      if (suggestion) {
        suggestions.push(suggestion);
      } else if (verbose) {
        console.log(`  [ok] ${fileName}:${lineNum} - ${methodName}() has validation`);
      }
    }
  }
}

function findComponentFiles(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findComponentFiles(fullPath));
      } else if (entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

console.log(`Checking component parameter validation in ${COMPONENTS_DIRS.join(', ')}...`);
if (verbose) console.log('');

const componentFiles = COMPONENTS_DIRS.flatMap(dir => findComponentFiles(dir));
for (const file of componentFiles) {
  checkFile(file);
}

console.log('');
if (suggestions.length > 0) {
  console.log('CQO-17 suggestions:\n');
  for (const s of suggestions) {
    console.log(`  ${s.file}:${s.line}`);
    console.log(`    Method: ${s.method}(${s.params.join(', ')})`);
    console.log(`    Consider: Add validation for ${s.params[0] || 'parameters'}`);
    console.log('');
  }
  console.log(`Found ${suggestions.length} method(s) without visible parameter validation`);
  console.log('');
  console.log('Recommended pattern:');
  console.log('  if (!chatId) throw new Error("MethodName: missing chatId");');
} else {
  console.log(`✓ CQO-17: Component methods have parameter validation`);
}

// Always exit 0 - this is advisory
process.exit(0);
