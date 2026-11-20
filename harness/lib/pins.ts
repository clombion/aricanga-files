/**
 * The pinned tools: each with its upstream repository, where it is pinned, and its pin.
 *
 * The tools are the root `devDependencies`, each at the version `pnpm-lock.yaml` resolves for the
 * root importer, and Node at the floor `engines.node` declares. `UPSTREAM` names each tool's
 * repository; `harness/scripts/gen-docs.ts` renders the table of `harness.md`.
 */

import { json, object } from './config.ts';
import { textOf } from './source-files.ts';

/** The upstream GitHub repository of every pinned tool, written as owner and repository name. */
export const UPSTREAM: ReadonlyMap<string, string> = new Map([
  ['@ai-sdk/anthropic', 'vercel/ai'],
  ['@ai-sdk/openai', 'vercel/ai'],
  ['@axe-core/playwright', 'dequelabs/axe-core-npm'],
  ['@biomejs/biome', 'biomejs/biome'],
  ['@commitlint/cli', 'conventional-changelog/commitlint'],
  ['@commitlint/config-conventional', 'conventional-changelog/commitlint'],
  ['@eslint/js', 'eslint/eslint'],
  ['@iarna/toml', 'iarna/iarna-toml'],
  ['@playwright/test', 'microsoft/playwright'],
  ['@types/iarna__toml', 'DefinitelyTyped/DefinitelyTyped'],
  ['@types/node', 'DefinitelyTyped/DefinitelyTyped'],
  ['@vitest/coverage-v8', 'vitest-dev/vitest'],
  ['ai', 'vercel/ai'],
  ['eslint', 'eslint/eslint'],
  ['eslint-import-resolver-typescript', 'import-js/eslint-import-resolver-typescript'],
  ['eslint-plugin-boundaries', 'javierbrea/eslint-plugin-boundaries'],
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
  ['remark-parse', 'remarkjs/remark'],
  ['sharp', 'lovell/sharp'],
  ['stylelint', 'stylelint/stylelint'],
  ['stylelint-config-standard', 'stylelint/stylelint-config-standard'],
  ['stylelint-no-unsupported-browser-features', 'RJWadley/stylelint-no-unsupported-browser-features'],
  ['stylelint-plugin-logical-css', 'yuschick/stylelint-plugin-logical-css'],
  ['typescript', 'microsoft/TypeScript'],
  ['typescript-eslint', 'typescript-eslint/typescript-eslint'],
  ['unified', 'unifiedjs/unified'],
  ['unist-util-visit', 'syntax-tree/unist-util-visit'],
  ['vite', 'vitejs/vite'],
  ['vitest', 'vitest-dev/vitest'],
]);

/** A pinned tool: its name, the file that pins it, and its version there. */
export interface Pin {
  readonly tool: string;
  readonly where: string;
  readonly version: string;
}

export class PinError extends Error {
  override readonly name = 'PinError';
}

const IMPORTER = /^ {2}(\S+):$/;
const SECTION = /^ {4}(dependencies|devDependencies|optionalDependencies):$/;
const ENTRY = /^ {6}'?([^':]+)'?:$/;
const VERSION = /^ {8}version: ([^(\s]+)/;

/** The versions `pnpm-lock.yaml` resolves for one importer, by package name. */
export function lockedVersions(lockText: string, importer = '.'): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  let inImporters = false;
  let inImporter = false;
  let inSection = false;
  let entry: string | undefined;
  for (const line of lockText.split('\n')) {
    if (/^\S/.test(line)) {
      inImporters = line === 'importers:';
      inImporter = false;
      continue;
    }
    const importerMatch = inImporters ? IMPORTER.exec(line) : null;
    if (importerMatch !== null) {
      inImporter = importerMatch[1] === importer;
      inSection = false;
      continue;
    }
    if (!inImporter) {
      continue;
    }
    if (SECTION.test(line)) {
      inSection = true;
      continue;
    }
    const entryMatch = inSection ? ENTRY.exec(line) : null;
    if (entryMatch !== null) {
      entry = entryMatch[1];
      continue;
    }
    const versionMatch = VERSION.exec(line);
    if (versionMatch !== null && entry !== undefined) {
      found.set(entry, versionMatch[1] ?? '');
      entry = undefined;
    }
  }
  return found;
}

/** Every pin: the root dev dependencies at their locked versions, and Node's declared floor. */
export function pinned(packageJson: unknown, lockText: string): readonly Pin[] {
  const manifest = object(packageJson, 'package.json');
  const locked = lockedVersions(lockText);
  const found = Object.keys(object(manifest['devDependencies'] ?? {}, 'devDependencies')).map((tool) => {
    const version = locked.get(tool);
    if (version === undefined) {
      throw new PinError(`${tool} is a dev dependency the lockfile does not resolve`);
    }
    return { tool, where: 'pnpm-lock.yaml', version };
  });
  const node = object(manifest['engines'] ?? {}, 'engines')['node'];
  if (typeof node === 'string') {
    found.push({ tool: 'node', where: 'package.json', version: node });
  }
  return found.toSorted((a, b) => a.tool.localeCompare(b.tool));
}

/** Every pin of this repository. */
export function pins(): readonly Pin[] {
  return pinned(json(textOf('package.json')), textOf('pnpm-lock.yaml'));
}
