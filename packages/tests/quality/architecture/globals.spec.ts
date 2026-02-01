/**
 * CQO-12: Explicit Imports and Declared Externals
 *
 * Verifies that JS files properly import dependencies and don't use
 * undeclared globals. Allowed window globals are explicitly listed.
 */
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Dynamically discover implementation directories
function getImplementationDirs(): string[] {
  const implRoot = 'implementations';
  if (!existsSync(implRoot)) return [];
  return readdirSync(implRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(implRoot, d.name, 'src'));
}

// Directories containing application JS (not vendored/generated)
const JS_DIRS = [
  ...getImplementationDirs(),
  'packages/framework/src/systems/conversation',
  'packages/framework/src/foundation/core',
  'packages/framework/src/foundation/services',
];

// Project-specific allowed window globals
const PROJECT_GLOBALS = new Set([
  'controller', // window.controller - main game controller
  'inkjs', // Vendored inkjs library
  'gameHub', // Component reference for debugging
  'gameThread', // Component reference for debugging
  'eventLogger', // Event logging for analytics
]);

// System hierarchy: implementations → systems → foundation
// Lower layers must NOT import from higher layers
const LAYER_RULES = {
  'packages/framework/src/foundation': {
    forbidden: ['implementations', 'packages/framework/src/systems'],
    description: 'Foundation must not import from systems or implementations',
  },
  'packages/framework/src/systems': {
    forbidden: ['implementations'],
    description: 'Systems must not import from implementations',
  },
};

test.describe('CQO-12: Import Hygiene', () => {
  test('all non-trivial JS files have imports', () => {
    const jsFiles: string[] = [];
    for (const dir of JS_DIRS) {
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.js'))
        .map((f) => join(dir, f));
      jsFiles.push(...files);
    }

    const filesWithoutImports: string[] = [];

    for (const file of jsFiles) {
      const content = readFileSync(file, 'utf-8');

      // Check for ES module imports/exports
      const hasImport = /^import\s+/m.test(content);
      const hasExport = /^export\s+/m.test(content);

      // Files must use ES modules (have import or export)
      // Files that only export (barrel files, constants) are valid
      if (!hasImport && !hasExport) {
        filesWithoutImports.push(file);
      }
    }

    // Allow files that legitimately have no imports
    // Config re-exports are allowed across all implementations
    const violations = filesWithoutImports.filter(
      (f) => !f.endsWith('/config.js')
    );

    expect(violations).toEqual([]);
  });

  test('window globals are explicitly allowed', async ({ page }) => {
    await page.goto('.');
    await page.waitForFunction(() => window.controller?.story);

    // Allowed project globals (passed to evaluate)
    const allowedGlobals = [...PROJECT_GLOBALS];

    // Get all properties added to window by our code
    const customGlobals = await page.evaluate((allowed) => {
      const allowedSet = new Set(allowed);

      // Get iframe to compare with clean window
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      const cleanWindow = iframe.contentWindow as Window;
      const cleanProps = new Set(Object.keys(cleanWindow));
      document.body.removeChild(iframe);

      // Find properties added by our code that aren't allowed
      const customProps = Object.keys(window).filter(
        (key) => !cleanProps.has(key) && !allowedSet.has(key)
      );

      return customProps;
    }, allowedGlobals);

    // Should have no additional globals beyond allowed list
    expect(customGlobals).toEqual([]);
  });

  test('generated config.js exports properly', () => {
    // Check all implementations' generated config files
    for (const implDir of getImplementationDirs()) {
      const configPath = join(implDir, 'generated/config.js');
      if (!existsSync(configPath)) continue;

      const content = readFileSync(configPath, 'utf-8');

      // Should use ES module exports
      expect(content, `${configPath} should use ES module exports`).toContain('export');

      // Should not attach to window
      expect(content, `${configPath} should not use window globals`).not.toContain('window.');
      expect(content, `${configPath} should not use globalThis`).not.toContain('globalThis.');
    }
  });

  test('components register via customElements.define', () => {
    const componentsDir = 'packages/framework/src/systems/conversation/components';
    const componentFiles = readdirSync(componentsDir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => join(componentsDir, f));

    for (const file of componentFiles) {
      const content = readFileSync(file, 'utf-8');

      // Only check files that define a component class (extends HTMLElement)
      const definesComponent = /class\s+\w+\s+extends\s+HTMLElement/.test(content);
      if (!definesComponent) continue;

      // Files that define components must register them
      const hasDefine = content.includes('customElements.define');
      expect(hasDefine, `${file} defines a component but doesn't register it`).toBe(true);
    }
  });

  test('no inverse dependencies (layer isolation)', () => {
    const violations: string[] = [];

    // Recursively get all JS files in a directory
    function getJsFiles(dir: string): string[] {
      const files: string[] = [];
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            // Skip generated directories
            if (entry.name === 'generated') continue;
            files.push(...getJsFiles(fullPath));
          } else if (entry.name.endsWith('.js')) {
            files.push(fullPath);
          }
        }
      } catch {
        // Directory doesn't exist
      }
      return files;
    }

    // Check each layer for forbidden imports
    for (const [layerDir, rules] of Object.entries(LAYER_RULES)) {
      const files = getJsFiles(layerDir);

      for (const file of files) {
        const content = readFileSync(file, 'utf-8');

        // Remove comments before checking imports (avoid false positives from doc examples)
        const codeOnly = content
          .replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
          .replace(/\/\/.*$/gm, ''); // Line comments

        // Extract all import paths from actual code
        const importMatches = codeOnly.matchAll(/from\s+['"]([^'"]+)['"]/g);

        for (const match of importMatches) {
          const importPath = match[1];

          // Check if import path references a forbidden layer
          for (const forbidden of rules.forbidden) {
            // Match both relative paths that resolve to forbidden and absolute-style paths
            if (
              importPath.includes(forbidden.replace('src/', '')) ||
              importPath.includes(forbidden)
            ) {
              violations.push(
                `${file}: imports from ${forbidden} (${importPath})\n  → ${rules.description}`
              );
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
