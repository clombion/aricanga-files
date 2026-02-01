#!/usr/bin/env node
/**
 * lint-workspace-resolution.js - Verify pnpm workspace protocol dependencies
 *
 * Checks that all "workspace:*" dependencies in package.json files:
 * - Resolve to actual packages in the pnpm workspace
 * - Have matching package names
 *
 * Usage: node utils/linting/repo/lint-workspace-resolution.js
 * Exit code: 0 if all resolve, 1 if unresolved dependencies found
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { parse as parseYaml } from 'node:path';

// Locations to check for package.json files
const PACKAGE_LOCATIONS = [
  '.',
  'packages/*',
  'experiences/*',
];

/**
 * Parse pnpm-workspace.yaml to get workspace package patterns
 */
function getWorkspacePatterns() {
  const workspaceFile = 'pnpm-workspace.yaml';

  if (!existsSync(workspaceFile)) {
    return [];
  }

  const content = readFileSync(workspaceFile, 'utf-8');

  // Simple YAML parsing for packages list
  const patterns = [];
  const lines = content.split('\n');
  let inPackages = false;

  for (const line of lines) {
    if (line.trim() === 'packages:') {
      inPackages = true;
      continue;
    }
    if (inPackages && line.trim().startsWith('-')) {
      const pattern = line.trim().replace(/^-\s*['"]?/, '').replace(/['"]?\s*$/, '');
      patterns.push(pattern);
    } else if (inPackages && !line.trim().startsWith('-') && line.trim()) {
      inPackages = false;
    }
  }

  return patterns;
}

/**
 * Expand glob patterns to find package.json files
 */
function findPackageJsonFiles(patterns) {
  const files = [];

  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Glob pattern
      const parts = pattern.split('/');
      const base = parts.slice(0, parts.indexOf('*')).join('/') || '.';
      const rest = parts.slice(parts.indexOf('*') + 1).join('/');

      if (existsSync(base)) {
        const entries = readdirSync(base, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const pkgPath = join(base, entry.name, rest, 'package.json').replace(/\/+/g, '/');
            if (existsSync(pkgPath)) {
              files.push(pkgPath);
            }
          }
        }
      }
    } else {
      // Literal path
      const pkgPath = join(pattern, 'package.json');
      if (existsSync(pkgPath)) {
        files.push(pkgPath);
      }
    }
  }

  // Always include root package.json
  if (existsSync('package.json') && !files.includes('package.json')) {
    files.unshift('package.json');
  }

  return files;
}

/**
 * Get all workspace packages and their names
 */
function getWorkspacePackages(patterns) {
  const packages = new Map();
  const pkgFiles = findPackageJsonFiles(patterns);

  for (const pkgPath of pkgFiles) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) {
        packages.set(pkg.name, {
          name: pkg.name,
          path: dirname(pkgPath),
          file: pkgPath,
        });
      }
    } catch (e) {
      console.warn(`Warning: Could not parse ${pkgPath}`);
    }
  }

  return packages;
}

/**
 * Find all workspace:* dependencies in a package.json
 */
function findWorkspaceDeps(pkgPath) {
  const deps = [];

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'];
    for (const type of depTypes) {
      if (pkg[type]) {
        for (const [name, version] of Object.entries(pkg[type])) {
          if (typeof version === 'string' && version.startsWith('workspace:')) {
            deps.push({ name, version, type });
          }
        }
      }
    }
  } catch (e) {
    // Ignore parse errors
  }

  return deps;
}

// Main
console.log('Checking workspace dependency resolution...\n');

// Get workspace patterns
const workspacePatterns = getWorkspacePatterns();

if (workspacePatterns.length === 0) {
  console.log('No pnpm-workspace.yaml found or no packages defined');
  console.log('Skipping workspace resolution check (not a pnpm workspace yet)');
  process.exit(0);
}

console.log(`Workspace patterns: ${workspacePatterns.join(', ')}`);

// Get all workspace packages
const workspacePackages = getWorkspacePackages(workspacePatterns);
console.log(`Found ${workspacePackages.size} workspace package(s)\n`);

// Check all package.json files for workspace deps
const allPkgFiles = findPackageJsonFiles(['.', ...workspacePatterns]);
const violations = [];

for (const pkgPath of allPkgFiles) {
  const workspaceDeps = findWorkspaceDeps(pkgPath);

  for (const dep of workspaceDeps) {
    const resolved = workspacePackages.get(dep.name);

    if (!resolved) {
      violations.push({
        file: pkgPath,
        dependency: dep.name,
        version: dep.version,
        type: dep.type,
        error: 'Package not found in workspace',
      });
    }
  }
}

if (violations.length === 0) {
  console.log('✓ All workspace dependencies resolve correctly');

  // Show summary
  let totalWorkspaceDeps = 0;
  for (const pkgPath of allPkgFiles) {
    const deps = findWorkspaceDeps(pkgPath);
    if (deps.length > 0) {
      console.log(`  ${pkgPath}: ${deps.map(d => d.name).join(', ')}`);
      totalWorkspaceDeps += deps.length;
    }
  }

  if (totalWorkspaceDeps === 0) {
    console.log('  (No workspace:* dependencies found)');
  }

  process.exit(0);
} else {
  console.log('Unresolved workspace dependencies:\n');

  for (const v of violations) {
    console.log(`  ${v.file}`);
    console.log(`    "${v.dependency}": "${v.version}" (${v.type})`);
    console.log(`    Error: ${v.error}`);
    console.log();
  }

  console.log(`Found ${violations.length} unresolved workspace dependency(ies)`);
  console.log('\nAvailable workspace packages:');
  for (const [name, info] of workspacePackages) {
    console.log(`  ${name} (${info.path})`);
  }

  process.exit(1);
}
