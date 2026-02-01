#!/usr/bin/env node
/**
 * lint-doc-links.js - Verify markdown links resolve to existing files
 *
 * Scans docs for relative links and verifies target files exist.
 * Catches broken links from file renames (e.g., layer-api.md to system-api.md).
 *
 * Also checks:
 * - Root README.md
 * - Backtick code references that look like source file paths
 * - Hardcoded implementation names in docs (should use {impl} placeholder)
 * - Deprecated path patterns in prose (src/experiences/, src/foundation/, etc.)
 * - Deprecated npx commands (should use pnpm exec or mise tasks)
 *
 * IMPL validation: Docs should not hardcode implementation names like "aricanga"
 * in code paths. Use `experiences/{impl}/` instead. This rule is skipped
 * for implementation-specific docs (docs/experiences/*, docs/transcripts/*).
 *
 * Usage: node utils/linting/repo/lint-doc-links.js
 * Exit code: 0 if all valid, 1 if violations found
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// Paths to scan
const DOCS_DIR = 'docs';
const ROOT_FILES = ['README.md', 'CONTRIBUTING.md', 'CLAUDE.md'].filter(f =>
  existsSync(f)
);

// Match markdown links: [text](path) but not URLs
const LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;

// Match backtick code references that look like source paths (e.g., `src/js/types.js`)
const CODE_REF_PATTERN = /`(src\/[^`\s]+)`/g;

// IMPL pattern detection - dynamically detect implementation names
const IMPL_NAMES = existsSync('implementations')
  ? readdirSync('implementations', { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name)
  : [];

// Docs that are allowed to reference specific implementations
// These patterns match implementation-specific doc folders and example documentation
const IMPL_SPECIFIC_DOC_PATTERNS = [
  /^docs\/[a-z][a-z0-9-]*\//, // docs/{impl}/ folders (e.g., docs/aricanga/)
  /story-transcript\.md$/,
  /^README\.md$/,  // Root README can reference example implementations
];

// Pattern to find hardcoded implementation paths in backticks
const HARDCODED_IMPL_PATTERN = new RegExp(
  `\`[^\`]*experiences/(${IMPL_NAMES.join('|')})/[^\`]*\``,
  'g'
);

// Deprecated path patterns - these old paths should be updated
// Matches both prose and diagrams (not just backticks)
// Uses negative lookbehind to exclude paths already prefixed with packages/framework/
const DEPRECATED_PATH_PATTERNS = [
  {
    // src/experiences/ → experiences/
    pattern: /\bsrc\/experiences\//g,
    replacement: 'experiences/',
    message: 'Use experiences/ instead of src/experiences/',
  },
  {
    // src/foundation/ → packages/framework/src/foundation/ (but not if already prefixed)
    pattern: /(?<!packages\/framework\/)src\/foundation\//g,
    replacement: 'packages/framework/src/foundation/',
    message: 'Use packages/framework/src/foundation/ instead of src/foundation/',
  },
  {
    // src/systems/ → packages/framework/src/systems/ (but not if already prefixed)
    pattern: /(?<!packages\/framework\/)src\/systems\//g,
    replacement: 'packages/framework/src/systems/',
    message: 'Use packages/framework/src/systems/ instead of src/systems/',
  },
  {
    // src/vendor/ → packages/framework/src/vendor/ (but not if already prefixed)
    pattern: /(?<!packages\/framework\/)src\/vendor\//g,
    replacement: 'packages/framework/src/vendor/',
    message: 'Use packages/framework/src/vendor/ instead of src/vendor/',
  },
];

// Deprecated npx commands - should use pnpm exec or mise tasks
const DEPRECATED_NPX_PATTERN = /\bnpx\s+\w+/g;

/**
 * Check if a doc file is allowed to reference specific implementations
 */
function isImplementationSpecificDoc(filePath) {
  return IMPL_SPECIFIC_DOC_PATTERNS.some(p => p.test(filePath));
}

/**
 * Extract hardcoded implementation violations from content
 */
function extractImplViolations(content, filePath) {
  if (isImplementationSpecificDoc(filePath)) return [];
  const violations = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    HARDCODED_IMPL_PATTERN.lastIndex = 0;
    let match;
    while ((match = HARDCODED_IMPL_PATTERN.exec(lines[i])) !== null) {
      violations.push({ line: i + 1, match: match[0] });
    }
  }
  return violations;
}

/**
 * Extract deprecated path pattern violations from content
 * Scans prose and diagrams (not just backticks) for old path patterns
 */
function extractDeprecatedPathViolations(content) {
  const violations = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, message } of DEPRECATED_PATH_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        violations.push({
          line: i + 1,
          match: match[0],
          message,
        });
      }
    }
  }
  return violations;
}

/**
 * Extract deprecated npx command violations from content
 */
function extractNpxViolations(content) {
  const violations = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    DEPRECATED_NPX_PATTERN.lastIndex = 0;
    let match;
    while ((match = DEPRECATED_NPX_PATTERN.exec(line)) !== null) {
      violations.push({
        line: i + 1,
        match: match[0],
        message: 'Use pnpm exec or mise tasks instead of npx',
      });
    }
  }
  return violations;
}

/**
 * Recursively get all markdown files in a directory
 */
function getMarkdownFiles(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a path is a URL (http, https, mailto, etc.)
 */
function isUrl(path) {
  return /^(https?:|mailto:|#|data:)/.test(path);
}

/**
 * Extract relative links from markdown content
 */
function extractLinks(content, filePath) {
  const links = [];
  let match;

  while ((match = LINK_PATTERN.exec(content)) !== null) {
    const [fullMatch, text, href] = match;

    // Skip URLs and anchor-only links
    if (isUrl(href)) continue;

    // Handle links with anchors (e.g., file.md#section)
    const pathPart = href.split('#')[0];
    if (!pathPart) continue; // Anchor-only link

    links.push({
      text,
      href,
      path: pathPart,
      line: content.substring(0, match.index).split('\n').length,
    });
  }

  return links;
}

/**
 * Extract code references that look like source paths
 */
function extractCodeRefs(content, filePath) {
  const refs = [];
  let match;

  while ((match = CODE_REF_PATTERN.exec(content)) !== null) {
    const [fullMatch, path] = match;
    refs.push({
      text: path,
      path,
      line: content.substring(0, match.index).split('\n').length,
    });
  }

  return refs;
}

/**
 * Verify a code ref resolves to an existing file (from project root)
 * - Skips paths with template placeholders like {impl}, {locale}, etc.
 * - For paths with file extensions (tutorial examples), verifies parent directory exists
 */
function verifyCodeRef(ref) {
  // Skip template paths (contain curly braces or wildcards)
  if (/[{}*]/.test(ref.path)) return true;

  // If exact path exists, it's valid
  if (existsSync(ref.path)) return true;

  // For paths with file extensions (likely tutorial examples),
  // verify the parent directory exists instead of the exact file
  const hasExtension = /\.\w+$/.test(ref.path);
  if (hasExtension) {
    const parentDir = dirname(ref.path);
    return existsSync(parentDir);
  }

  return false;
}

/**
 * Verify a link resolves to an existing file
 */
function verifyLink(link, sourceFile) {
  const sourceDir = dirname(sourceFile);
  // Decode URL-encoded characters (e.g., %20 -> space)
  const decodedPath = decodeURIComponent(link.path);
  const targetPath = resolve(sourceDir, decodedPath);

  // Check if file exists
  if (existsSync(targetPath)) {
    // If it's a directory, it's valid for browsing purposes
    // (GitHub and file browsers can navigate to directories)
    return true;
  }

  // Try with .md extension if not specified
  if (!link.path.endsWith('.md') && existsSync(targetPath + '.md')) {
    return true;
  }

  return false;
}

// Main
console.log('Checking documentation links...\n');

// Collect all files to check
const docsFiles = getMarkdownFiles(DOCS_DIR);
const allFiles = [...ROOT_FILES, ...docsFiles];

const linkViolations = [];
const codeRefViolations = [];
const implViolations = [];
const deprecatedPathViolations = [];
const npxViolations = [];

for (const file of allFiles) {
  const content = readFileSync(file, 'utf-8');
  const links = extractLinks(content, file);

  for (const link of links) {
    if (!verifyLink(link, file)) {
      linkViolations.push({
        file,
        line: link.line,
        href: link.href,
        text: link.text,
      });
    }
  }

  // Check code references
  const codeRefs = extractCodeRefs(content, file);
  for (const ref of codeRefs) {
    if (!verifyCodeRef(ref)) {
      codeRefViolations.push({
        file,
        line: ref.line,
        path: ref.path,
      });
    }
  }

  // Check for hardcoded implementation names
  const implViols = extractImplViolations(content, file);
  for (const v of implViols) {
    implViolations.push({
      file,
      line: v.line,
      match: v.match,
    });
  }

  // Check for deprecated path patterns
  const pathViols = extractDeprecatedPathViolations(content);
  for (const v of pathViols) {
    deprecatedPathViolations.push({
      file,
      line: v.line,
      match: v.match,
      message: v.message,
    });
  }

  // Check for deprecated npx commands
  const npxViols = extractNpxViolations(content);
  for (const v of npxViols) {
    npxViolations.push({
      file,
      line: v.line,
      match: v.match,
      message: v.message,
    });
  }
}

const hasErrors =
  linkViolations.length > 0 ||
  codeRefViolations.length > 0 ||
  implViolations.length > 0 ||
  deprecatedPathViolations.length > 0 ||
  npxViolations.length > 0;

if (linkViolations.length === 0) {
  console.log(`✓ All markdown links valid (checked ${allFiles.length} files)`);
} else {
  console.log('Broken markdown links found:\n');
  for (const v of linkViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    [${v.text}](${v.href})`);
    console.log();
  }
  console.log(`Found ${linkViolations.length} broken link(s)`);
}

if (codeRefViolations.length === 0) {
  console.log(`✓ All code references valid`);
} else {
  console.log('\nBroken code references found:\n');
  for (const v of codeRefViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    \`${v.path}\``);
    console.log();
  }
  console.log(`Found ${codeRefViolations.length} broken code reference(s)`);
}

if (implViolations.length === 0) {
  console.log(`✓ No hardcoded implementation names`);
} else {
  console.log('\nHardcoded implementation names found (use {impl} placeholder instead):\n');
  for (const v of implViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    ${v.match}`);
    console.log();
  }
  console.log(`Found ${implViolations.length} hardcoded implementation reference(s)`);
}

if (deprecatedPathViolations.length === 0) {
  console.log(`✓ No deprecated path patterns`);
} else {
  console.log('\nDeprecated path patterns found:\n');
  for (const v of deprecatedPathViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    "${v.match}" → ${v.message}`);
    console.log();
  }
  console.log(`Found ${deprecatedPathViolations.length} deprecated path pattern(s)`);
}

if (npxViolations.length === 0) {
  console.log(`✓ No deprecated npx commands`);
} else {
  console.log('\nDeprecated npx commands found:\n');
  for (const v of npxViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    "${v.match}" → ${v.message}`);
    console.log();
  }
  console.log(`Found ${npxViolations.length} deprecated npx command(s)`);
}

process.exit(hasErrors ? 1 : 0);
