#!/usr/bin/env node
/**
 * lint-component-registration.js - Verify all expected components are registered
 *
 * Ensures every element in the expectedElements array has a corresponding
 * side-effect import that registers the custom element.
 *
 * Catches: Missing imports in conversation/index.js that cause components
 * to render as empty/black because customElements.define() never runs.
 *
 * Usage: node utils/linting/source/lint-component-registration.js
 * Exit code: 0 if all components registered, 1 if missing registrations
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

// File paths
const COMPONENTS_INDEX =
  'packages/framework/src/systems/conversation/components/index.js';
const CONVERSATION_INDEX =
  'packages/framework/src/systems/conversation/index.js';
const COMPONENTS_DIR =
  'packages/framework/src/systems/conversation/components';
const CHAT_THREAD_DIR =
  'packages/framework/src/systems/conversation/components/chat-thread';

/**
 * Extract expectedElements array from components/index.js
 */
function getExpectedElements(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // Match: const expectedElements = [ ... ];
  const match = content.match(
    /const\s+expectedElements\s*=\s*\[([\s\S]*?)\];/,
  );
  if (!match) {
    console.error('Could not find expectedElements array in', filePath);
    process.exit(1);
  }

  // Parse the array contents
  const arrayContent = match[1];
  const elements = arrayContent
    .split(',')
    .map((s) => s.trim())
    .map((s) => s.replace(/['"]/g, '')) // Remove quotes
    .filter((s) => s && !s.startsWith('//')); // Remove empty and comments

  return elements;
}

/**
 * Extract side-effect imports from a file
 * Matches: import './path/to/file.js';
 */
function getSideEffectImports(filePath) {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, 'utf-8');

  // Match: import './something.js'; or import "./something.js";
  const pattern = /import\s+['"]([^'"]+)['"]\s*;/g;
  const imports = [];
  let match;

  while ((match = pattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Convert import path to element name
 * './components/chat-hub.js' -> 'chat-hub'
 * './chat-header.js' -> 'chat-header'
 */
function importPathToElementName(importPath) {
  const filename = basename(importPath, '.js');
  return filename === 'index' ? null : filename;
}

/**
 * Get all component files that define custom elements
 */
function getComponentFiles(dir, recursive = false) {
  const files = [];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory() && recursive) {
      files.push(...getComponentFiles(fullPath, true));
    } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a file contains customElements.define for the given element
 */
function fileDefinesElement(filePath, elementName) {
  if (!existsSync(filePath)) return false;

  const content = readFileSync(filePath, 'utf-8');
  // Match: customElements.define('element-name', ...)
  const pattern = new RegExp(
    `customElements\\.define\\s*\\(\\s*['"]${elementName}['"]`,
  );
  return pattern.test(content);
}

/**
 * Find which file defines an element
 */
function findElementDefinition(elementName, searchDirs) {
  for (const dir of searchDirs) {
    const files = getComponentFiles(dir, true);

    for (const file of files) {
      if (fileDefinesElement(file, elementName)) {
        return file;
      }
    }

    // Also check index.js files
    const indexPath = join(dir, 'index.js');
    if (existsSync(indexPath) && fileDefinesElement(indexPath, elementName)) {
      return indexPath;
    }
  }

  return null;
}

/**
 * Extract named export sources from a file.
 * Matches: export { Foo } from './bar.js';
 */
function getExportSources(filePath) {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  const pattern = /export\s*\{[^}]+\}\s*from\s*['"]([^'"]+)['"]/g;
  const sources = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    sources.push(match[1]);
  }
  return sources;
}

/**
 * Check if an element is registered via imports chain.
 * Components can be registered via:
 *   - Side-effect imports in conversation/index.js (legacy)
 *   - Named exports in components/index.js (triggers define() as side effect)
 *   - Side-effect imports in chat-thread/index.js (sub-components)
 */
function isElementRegistered(elementName, conversationImports, chatThreadImports, componentExports) {
  // Check side-effect imports in conversation/index.js
  for (const imp of conversationImports) {
    const name = importPathToElementName(imp);
    if (name === elementName) return true;

    if (name === 'chat-thread' && chatThreadImports.some(
      (i) => importPathToElementName(i) === elementName,
    )) {
      return true;
    }
  }

  // Check named exports in components/index.js (deferred registration via BUG-002 fix)
  for (const src of componentExports) {
    const name = importPathToElementName(src);
    if (name === elementName) return true;

    // chat-thread export pulls in sub-components
    if (name === 'chat-thread' && chatThreadImports.some(
      (i) => importPathToElementName(i) === elementName,
    )) {
      return true;
    }
  }

  // Check sub-components in chat-thread/index.js
  for (const imp of chatThreadImports) {
    if (importPathToElementName(imp) === elementName) return true;
  }

  return false;
}

// Main
console.log('Checking component registration...\n');

// Get expected elements
const expectedElements = getExpectedElements(COMPONENTS_INDEX);
console.log(`Found ${expectedElements.length} expected elements\n`);

// Get imports from conversation/index.js (legacy side-effect imports, if any)
const conversationImports = getSideEffectImports(CONVERSATION_INDEX);

// Get named exports from components/index.js (deferred registration via BUG-002 fix)
const componentExports = getExportSources(COMPONENTS_INDEX);

// Get imports from chat-thread/index.js
const chatThreadImports = getSideEffectImports(join(CHAT_THREAD_DIR, 'index.js'));

// Track violations
const violations = [];
const warnings = [];

// Components that are expected but defined elsewhere (experience-specific)
const EXTERNAL_COMPONENTS = ['settings-page', 'debug-panel'];

for (const element of expectedElements) {
  // Skip external components
  if (EXTERNAL_COMPONENTS.includes(element)) {
    continue;
  }

  // Find where the element is defined
  const definitionFile = findElementDefinition(element, [
    COMPONENTS_DIR,
    CHAT_THREAD_DIR,
  ]);

  if (!definitionFile) {
    warnings.push({
      element,
      message: `No file found defining customElements.define('${element}', ...)`,
    });
    continue;
  }

  // Check if it's registered via imports
  if (!isElementRegistered(element, conversationImports, chatThreadImports, componentExports)) {
    // Determine where it should be imported
    const isSubComponent = definitionFile.includes('chat-thread/');
    const shouldBeIn = isSubComponent
      ? 'chat-thread/index.js'
      : 'conversation/index.js';

    violations.push({
      element,
      definitionFile,
      shouldBeIn,
      message: `Component '${element}' is defined but not imported`,
    });
  }
}

// Report results
if (warnings.length > 0) {
  console.log('Warnings:\n');
  for (const w of warnings) {
    console.log(`  ⚠ ${w.element}: ${w.message}`);
  }
  console.log();
}

if (violations.length === 0) {
  console.log(
    `✓ All ${expectedElements.length - EXTERNAL_COMPONENTS.length} framework components are registered`,
  );
  process.exit(0);
} else {
  console.log('Missing component registrations:\n');

  for (const v of violations) {
    console.log(`  ✗ ${v.element}`);
    console.log(`    Defined in: ${v.definitionFile}`);
    console.log(`    Missing import in: ${v.shouldBeIn}`);
    console.log();
  }

  console.log('To fix, add side-effect imports:\n');

  // Group by target file
  const byTarget = {};
  for (const v of violations) {
    if (!byTarget[v.shouldBeIn]) byTarget[v.shouldBeIn] = [];
    byTarget[v.shouldBeIn].push(v);
  }

  for (const [target, items] of Object.entries(byTarget)) {
    console.log(`  In ${target}:`);
    for (const item of items) {
      const relativePath = item.definitionFile
        .replace('packages/framework/src/systems/conversation/', './')
        .replace('components/chat-thread/', './');
      console.log(`    import '${relativePath}';`);
    }
    console.log();
  }

  console.log(`Found ${violations.length} missing registration(s)`);
  process.exit(1);
}
