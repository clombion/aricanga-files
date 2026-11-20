/**
 * The pinned tools: each with its upstream repository, where it is pinned, and its pin.
 *
 * The pins are the root `package.json`'s dependencies and devDependencies and the devDependencies
 * of every held workspace package, each at the version `pnpm-lock.yaml` holds, plus Node's
 * `engines.node` floor and pnpm's `packageManager`. `UPSTREAM` names each tool's repository; the
 * tool-upgrades check fails on a pin it does not name and on a row that pins nothing, and
 * `harness/lib/generated.ts` renders the table of `harness.md`.
 */

import { object, json } from './config.ts';
import { held } from './scope.ts';
import { textOf, tracked } from './source-files.ts';

/** The upstream GitHub repository of every pinned tool, written as owner and repository name. */
export const UPSTREAM: ReadonlyMap<string, string> = new Map([
  ['@ai-sdk/anthropic', 'vercel/ai'],
  ['@ai-sdk/google', 'vercel/ai'],
  ['@ai-sdk/openai', 'vercel/ai'],
  ['@axe-core/playwright', 'dequelabs/axe-core-npm'],
  ['@biomejs/biome', 'biomejs/biome'],
  ['@commitlint/cli', 'conventional-changelog/commitlint'],
  ['@commitlint/config-conventional', 'conventional-changelog/commitlint'],
  ['@double-great/stylelint-a11y', 'double-great/stylelint-a11y'],
  ['@iarna/toml', 'iarna/iarna-toml'],
  ['@playwright/test', 'microsoft/playwright'],
  ['@solidjs/compiler', 'solidjs/solid'],
  ['@solidjs/vite-plugin', 'solidjs/vite-plugin-solid'],
  ['@types/iarna__toml', 'DefinitelyTyped/DefinitelyTyped'],
  ['@types/node', 'DefinitelyTyped/DefinitelyTyped'],
  ['@vitest/coverage-v8', 'vitest-dev/vitest'],
  ['@viz-js/viz', 'mdaines/viz-js'],
  ['ai', 'vercel/ai'],
  ['eslint', 'eslint/eslint'],
  ['eslint-plugin-solid', 'solidjs-community/eslint-plugin-solid'],
  ['fast-check', 'dubzzz/fast-check'],
  ['happy-dom', 'capricorn86/happy-dom'],
  ['inkjs', 'y-lohse/inkjs'],
  ['jscpd', 'kucherenko/jscpd'],
  ['knip', 'webpro-nl/knip'],
  ['lefthook', 'evilmartians/lefthook'],
  ['node', 'nodejs/node'],
  ['oxfmt', 'oxc-project/oxc'],
  ['oxlint', 'oxc-project/oxc'],
  ['oxlint-tsgolint', 'oxc-project/tsgolint'],
  ['pnpm', 'pnpm/pnpm'],
  ['remark-parse', 'remarkjs/remark'],
  ['sharp', 'lovell/sharp'],
  ['stylelint', 'stylelint/stylelint'],
  ['stylelint-config-standard', 'stylelint/stylelint-config-standard'],
  ['stylelint-declaration-strict-value', 'AndyOGo/stylelint-declaration-strict-value'],
  ['stylelint-no-unsupported-browser-features', 'RJWadley/stylelint-no-unsupported-browser-features'],
  ['stylelint-plugin-logical-css', 'yuschick/stylelint-plugin-logical-css'],
  ['typescript', 'microsoft/TypeScript'],
  ['unified', 'unifiedjs/unified'],
  ['unist-util-visit', 'syntax-tree/unist-util-visit'],
  ['vite', 'vitejs/vite'],
  ['vitest', 'vitest-dev/vitest'],
  ['xstate', 'statelyai/xstate'],
  ['zod', 'colinhacks/zod'],
]);

/** A pinned tool: its name, the file that pins it, and its version there. */
export interface Pin {
  readonly tool: string;
  readonly where: string;
  readonly version: string;
}

const LOCKFILE = 'pnpm-lock.yaml';
const WORKSPACE = 'workspace:';

/**
 * The resolved versions of one importer of a pnpm lockfile, by package name. The lockfile is read
 * as the indented text pnpm writes: `importers:` → `  <importer>:` → `    <group>:` →
 * `      <name>:` → `        version: <version>(<peers>)`.
 */
export function locked(lockText: string, importer: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  let inImporters = false;
  let inImporter = false;
  let name: string | undefined;
  for (const line of lockText.split('\n')) {
    if (/^\S/.test(line)) {
      inImporters = line === 'importers:';
      inImporter = false;
      continue;
    }
    const importerLine = /^ {2}(\S.*):$/.exec(line);
    if (inImporters && importerLine !== null) {
      inImporter = importerLine[1] === importer;
      continue;
    }
    const nameLine = /^ {6}'?([^':]+)'?:$/.exec(line);
    if (inImporter && nameLine !== null) {
      name = nameLine[1];
      continue;
    }
    const versionLine = /^ {8}version: ([^(\s]+)/.exec(line);
    if (inImporter && name !== undefined && versionLine?.[1] !== undefined) {
      found.set(name, versionLine[1]);
    }
  }
  return found;
}

function strings(value: unknown, what: string): Readonly<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const [key, entry] of Object.entries(object(value ?? {}, what))) {
    if (typeof entry === 'string') {
      found[key] = entry;
    }
  }
  return found;
}

/** A workspace package's manifest, keyed by its directory (`.` for the root). */
export interface Manifest {
  readonly importer: string;
  readonly manifest: unknown;
}

/** Every pin of the given manifests at the versions the lockfile holds. */
export function pinned(manifests: readonly Manifest[], lockText: string): readonly Pin[] {
  const found: Pin[] = [];
  for (const { importer, manifest } of manifests) {
    const fields = object(manifest, `${importer}/package.json`);
    const versions = locked(lockText, importer);
    const groups = importer === '.' ? ['dependencies', 'devDependencies'] : ['devDependencies'];
    for (const group of groups) {
      for (const [tool, specifier] of Object.entries(strings(fields[group], `${importer} ${group}`))) {
        if (!specifier.startsWith(WORKSPACE)) {
          found.push({ tool, where: LOCKFILE, version: versions.get(tool) ?? '' });
        }
      }
    }
    if (importer === '.') {
      found.push({ tool: 'node', where: 'package.json engines', version: strings(fields['engines'], 'engines')['node'] ?? '' });
      const manager = typeof fields['packageManager'] === 'string' ? fields['packageManager'] : '';
      found.push({ tool: 'pnpm', where: 'package.json packageManager', version: manager.replace(/^pnpm@/, '') });
    }
  }
  const unique = new Map(found.map((pin) => [pin.tool, pin]));
  return [...unique.values()].toSorted((a, b) => a.tool.localeCompare(b.tool));
}

/** Every pin of this repository: the root manifest and each held workspace package's. */
export function pins(): readonly Pin[] {
  const manifests = tracked()
    .filter((path) => path === 'package.json' || (held(path) && path.endsWith('/package.json')))
    .map((path) => ({
      importer: path === 'package.json' ? '.' : path.slice(0, -'/package.json'.length),
      manifest: json(textOf(path)),
    }));
  return pinned(manifests, textOf(LOCKFILE));
}
