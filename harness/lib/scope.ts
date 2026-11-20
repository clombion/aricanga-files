/**
 * What the harness holds: the rebuild's roots. The POC reference (ADR-0006, "Scope") stays outside
 * until it is deleted, and every scan asks this module, never a list of its own.
 */

import { Accepted } from './exemptions.ts';
import { isEmpty } from './lists.ts';
import { tracked } from './source-files.ts';

/** The top-level paths whose files the harness holds. */
const ROOTS: readonly string[] = [
  'packages/foundation/',
  'packages/systems/',
  'packages/characterisation/',
  'experiences/sandbox/',
  'harness/',
];

/** Root files the harness holds besides the roots: the configuration the gate reads. */
const ROOT_FILES = new Accepted<string>([
  'package.json',
  'tsconfig.json',
  'tsconfig.base.json',
  '.oxlintrc.json',
  '.oxfmtrc.json',
  'biome.json',
  'knip.json',
  'lefthook.json',
  '.commitlintrc.json',
  'docs/terms.toml',
  'vitest.gate.config.ts',
  'AGENTS.md',
  'CLAUDE.md',
  'harness.md',
  'HARNESS_STATUS.md',
  '.stylelintrc.json',
  '.node-version',
]);

/** The current text the docs checks read: the agent brief, the harness docs and the roadmap. */
const DOC_ROOTS: readonly string[] = ['docs/roadmap/', 'harness/', 'packages/characterisation/'];

/**
 * Whether a listed path is held by the harness.
 *
 * @param {string} path - A repository-relative path.
 * @returns {boolean} Whether the harness holds it.
 */
function held(path: string): boolean {
  return ROOT_FILES.has(path) || ROOTS.some((root) => path.startsWith(root));
}

/**
 * The listed files the harness holds, optionally filtered by suffix.
 *
 * @param {readonly string[]} suffixes - The suffixes to keep; none keeps every file.
 * @returns {readonly string[]} The held files.
 */
function heldFiles(...suffixes: readonly string[]): readonly string[] {
  return tracked().filter(
    (path) => held(path) && (isEmpty(suffixes) || suffixes.some((suffix) => path.endsWith(suffix))),
  );
}

/**
 * The held TypeScript sources.
 *
 * @returns {readonly string[]} The held `.ts` and `.tsx` files.
 */
function typescriptFiles(): readonly string[] {
  return heldFiles('.ts', '.tsx');
}

export { DOC_ROOTS, held, heldFiles, ROOTS, typescriptFiles };
