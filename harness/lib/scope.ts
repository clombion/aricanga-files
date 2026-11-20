/**
 * What the harness holds: the rebuild's roots. The POC reference (ADR-0006, "Scope") stays outside
 * until it is deleted, and every scan asks this module, never a list of its own.
 */

import { tracked } from './source-files.ts';

/** The top-level paths whose files the harness holds. */
export const ROOTS: readonly string[] = [
  'packages/foundation/',
  'packages/systems/',
  'packages/characterisation/',
  'experiences/sandbox/',
  'harness/',
];

/** Root files the harness holds besides the roots: the configuration the gate reads. */
export const ROOT_FILES: readonly string[] = [
  'package.json',
  'tsconfig.json',
  'tsconfig.base.json',
  '.oxlintrc.json',
  '.oxfmtrc.json',
  'biome.json',
  'knip.json',
  'lefthook.json',
  '.commitlintrc.json',
  'vitest.gate.config.ts',
  'AGENTS.md',
  'CLAUDE.md',
  'harness.md',
  'HARNESS_STATUS.md',
];

/** The current text the docs checks read: the agent brief, the harness docs and the roadmap. */
export const DOC_ROOTS: readonly string[] = ['docs/roadmap/', 'harness/', 'packages/characterisation/'];

/** Whether a listed path is held by the harness. */
export function held(path: string): boolean {
  return ROOT_FILES.includes(path) || ROOTS.some((root) => path.startsWith(root));
}

/** The listed files the harness holds, optionally filtered by suffix. */
export function heldFiles(...suffixes: string[]): readonly string[] {
  return tracked().filter((path) => held(path) && (suffixes.length === 0 || suffixes.some((s) => path.endsWith(s))));
}

/** The held TypeScript sources (`.ts`, `.tsx`). */
export function typescriptFiles(): readonly string[] {
  return heldFiles('.ts', '.tsx');
}
