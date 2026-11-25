/**
 * The file globs oxlint's configuration names that are no member's: the root modules and the harness's
 * code, anchored as an override's `files` anchors a root file, and the listing's unheld lintable
 * files, anchored as `ignorePatterns` anchors one. oxlint reads a slashless glob at any depth in both fields, so a root
 * file is never named bare (`harness/lint-rules/globs.ts`).
 */

import { FILES_ANCHOR, IGNORE_ANCHOR } from '#lint-rules/globs.ts';
import { HARNESS_ROOT } from './scope.ts';
import type { Population } from './scope.ts';
import { ROOT_MODULES } from './config-modules.ts';
import { dirname } from 'node:path/posix';

/** The extensions oxlint lints. */
const LINTED = /\.(?:[cm]?[jt]sx?)$/u;

/**
 * Whether oxlint lints a file, by its extension.
 *
 * @param {string} file - The path.
 * @returns {boolean} Whether oxlint lints it.
 */
function isLintable(file: string): boolean {
  return LINTED.test(file);
}

/** The root configuration modules, as an override's `files` names them. */
const ROOT_MODULE_FILES: readonly string[] = ROOT_MODULES.map((module) => `${FILES_ANCHOR}${module}`);

/** The harness's code, as an override's `files` names it: its directory, and the root modules that run it. */
const HARNESS_CODE: readonly string[] = [`${HARNESS_ROOT}**`, ...ROOT_MODULE_FILES];

/**
 * The directories above a path, the topmost first, each with its closing `/`.
 *
 * @param {string} file - The path.
 * @returns {readonly string[]} Its ancestors.
 */
function ancestors(file: string): readonly string[] {
  const parent = dirname(file);
  return parent === '.' ? [] : [...ancestors(parent), `${parent}/`];
}

/**
 * The listed lintable files the population does not hold, each as the topmost directory above it that
 * holds no held file (`<dir>**`), or as itself where every directory above it does.
 *
 * @param {Population} held - The population.
 * @returns {string[]} The ignore patterns, sorted.
 */
function unheldPatterns(held: Population): string[] {
  const kept = held.listing.filter((file) => held.holds(file));
  const patterns = held.listing
    .filter((file) => isLintable(file) && !held.holds(file))
    .map((file) => {
      const top = ancestors(file).find((dir) => !kept.some((path) => path.startsWith(dir)));
      return top === undefined ? `${IGNORE_ANCHOR}${file}` : `${top}**`;
    });
  return [...new Set(patterns)].toSorted();
}

export { HARNESS_CODE, isLintable, ROOT_MODULE_FILES, unheldPatterns };
