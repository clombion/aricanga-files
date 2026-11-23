/**
 * The pinned tools: each with its upstream repository, where it is pinned, and its pin.
 *
 * The pins are the root `package.json`'s dependencies and devDependencies and the devDependencies
 * of every held workspace package, each at the version `pnpm-lock.yaml` holds, read as YAML, plus
 * Node's `engines.node` floor and pnpm's `packageManager`. `UPSTREAM` names each tool's repository; the
 * tool-upgrades check fails on a pin it does not name and on a row that pins nothing, and
 * `harness/lib/generated.ts` renders the table of `harness.md`.
 */

import { ConfigError, json, object } from './config.ts';
import { textOf, textsOf, tracked } from './source-files.ts';
import { engineRange } from './node-floor.ts';
import { held } from './scope.ts';
import { parse } from 'yaml';

/** A pinned tool: its name, the file that pins it, and its version there. */
interface Pin {
  readonly tool: string;
  readonly where: string;
  readonly version: string;
}

/** A workspace package's manifest, keyed by its directory (`.` for the root). */
interface Manifest {
  readonly importer: string;
  readonly manifest: unknown;
}

/** The upstream GitHub repository of every pinned tool, written as owner and repository name. */
const UPSTREAM: ReadonlyMap<string, string> = new Map([
  ['@ai-sdk/anthropic', 'vercel/ai'],
  ['@ai-sdk/google', 'vercel/ai'],
  ['@ai-sdk/openai', 'vercel/ai'],
  ['@axe-core/playwright', 'dequelabs/axe-core-npm'],
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
  ['stylelint-order', 'hudochenkov/stylelint-order'],
  ['stylelint-plugin-logical-css', 'yuschick/stylelint-plugin-logical-css'],
  ['typescript', 'microsoft/TypeScript'],
  ['unified', 'unifiedjs/unified'],
  ['unist-util-visit', 'syntax-tree/unist-util-visit'],
  ['vite', 'vitejs/vite'],
  ['vitest', 'vitest-dev/vitest'],
  ['xstate', 'statelyai/xstate'],
  ['yaml', 'eemeli/yaml'],
  ['zod', 'colinhacks/zod'],
]);

const LOCKFILE = 'pnpm-lock.yaml';
const WORKSPACE = 'workspace:';

const PNPM_PREFIX = /^pnpm@/u;
const MANIFEST_SUFFIX = /\/package\.json$/u;

/**
 * The dependency groups pnpm writes in a lockfile importer (pnpm's `DEPENDENCIES_FIELDS`). A package a
 * manifest lists in two groups is written once, in the group pnpm resolves it to (optional over dev),
 * so a pin is looked up in every group, whatever group its manifest lists it in.
 */
const LOCK_GROUPS: readonly string[] = ['optionalDependencies', 'dependencies', 'devDependencies'];

/** The peers pnpm appends to a resolved version: `1.0.3(peer@2.0.0)`. */
const PEERS = /\(.*$/u;

/**
 * A manifest field's string entries, or a refusal naming the first that is not a string.
 *
 * @param {unknown} value - The field's value.
 * @param {string} what - What it is, for the refusal.
 * @returns {Readonly<Record<string, string>>} The entries.
 */
function strings(value: unknown, what: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(object(value ?? {}, what)).map(([key, entry]: readonly [string, unknown]) => {
      if (typeof entry !== 'string') {
        throw new ConfigError(`${what}.${key} is not a string: ${JSON.stringify(entry)}`);
      }
      return [key, entry] as const;
    }),
  );
}

/**
 * A lockfile's text read as YAML, refusing text that is not YAML by naming the lockfile.
 *
 * @param {string} lockText - The lockfile's text.
 * @returns {unknown} The parsed value.
 */
function yamlOf(lockText: string): unknown {
  try {
    return parse(lockText);
  } catch (error: unknown) {
    throw new ConfigError(`${LOCKFILE} is not YAML: ${String(error)}`, { cause: error });
  }
}

/**
 * The `importers` mapping of a pnpm lockfile, read as YAML: each importer by its key as YAML reads it
 * (quoted or plain, `{}` for an importer with no dependencies). An importer holds its dependency
 * groups and pnpm's other fields (`publishDirectory`, `dependenciesMeta`). Text that is not YAML (a
 * merge conflict, a duplicate key) and a lockfile with no `importers` mapping refuse with `ConfigError`.
 *
 * @param {string} lockText - The lockfile's text.
 * @returns {Readonly<Record<string, unknown>>} Each importer, by its key.
 */
function importerGroups(lockText: string): Readonly<Record<string, unknown>> {
  const lock = object(yamlOf(lockText), LOCKFILE);
  return object(lock['importers'], `${LOCKFILE} importers`);
}

/**
 * The resolved versions of one importer, by package name, without their peers, from every dependency
 * group pnpm writes (`LOCK_GROUPS`). The importer's other fields (`publishDirectory`,
 * `dependenciesMeta`) are not read. An entry with no `version` is left out, so its pin reads as one
 * with no version, the same as a package the lockfile does not hold.
 *
 * @param {string} lockText - The lockfile's text.
 * @param {string} importer - The importer, `.` for the root.
 * @returns {ReadonlyMap<string, string>} Each package's resolved version, by name.
 */
function locked(lockText: string, importer: string): ReadonlyMap<string, string> {
  const fields = object(importerGroups(lockText)[importer] ?? {}, `${LOCKFILE} ${importer}`);
  return new Map(
    LOCK_GROUPS.flatMap((group) =>
      Object.entries(object(Object.hasOwn(fields, group) ? fields[group] : {}, `${LOCKFILE} ${importer} ${group}`)).flatMap(
        ([name, entry]: readonly [string, unknown]) => {
          const { version } = object(entry, `${LOCKFILE} ${importer} ${group} ${name}`);
          return typeof version === 'string' ? [[name, version.replace(PEERS, '')] as const] : [];
        },
      ),
    ),
  );
}

/**
 * The root manifest's pins beyond its dependencies: Node's floor and pnpm's `packageManager`.
 *
 * @param {unknown} manifest - The root `package.json`.
 * @returns {readonly Pin[]} The two pins.
 */
function rootPins(manifest: unknown): readonly Pin[] {
  const fields = object(manifest, 'package.json');
  const manager = typeof fields['packageManager'] === 'string' ? fields['packageManager'] : '';
  return [
    { tool: 'node', version: engineRange(manifest), where: 'package.json engines' },
    { tool: 'pnpm', version: manager.replace(PNPM_PREFIX, ''), where: 'package.json packageManager' },
  ];
}

/**
 * The pins of one manifest at the versions the lockfile holds.
 *
 * @param {Manifest} entry - The manifest and its importer.
 * @param {string} lockText - The lockfile's text.
 * @returns {readonly Pin[]} Its pins.
 */
function manifestPins(entry: Manifest, lockText: string): readonly Pin[] {
  const { importer, manifest } = entry;
  const fields = object(manifest, `${importer}/package.json`);
  const groups = importer === '.' ? ['dependencies', 'devDependencies'] : ['devDependencies'];
  const versions = locked(lockText, importer);
  const dependencies = groups.flatMap((group) =>
    Object.entries(strings(fields[group], `${importer} ${group}`))
      .filter(([, specifier]: readonly [string, string]) => !specifier.startsWith(WORKSPACE))
      .map(([tool]: readonly [string, string]): Pin => ({ tool, version: versions.get(tool) ?? '', where: LOCKFILE })),
  );
  return importer === '.' ? [...dependencies, ...rootPins(manifest)] : dependencies;
}

/**
 * Every pin of the given manifests at the versions the lockfile holds.
 *
 * @param {readonly Manifest[]} manifests - The manifests.
 * @param {string} lockText - The lockfile's text.
 * @returns {readonly Pin[]} The pins, one per tool, sorted by tool.
 */
function pinned(manifests: readonly Manifest[], lockText: string): readonly Pin[] {
  const found = manifests.flatMap((entry) => manifestPins(entry, lockText));
  const unique = new Map(found.map((pin) => [pin.tool, pin] as const));
  return [...unique.values()].toSorted((first, second) => first.tool.localeCompare(second.tool));
}

/**
 * Every pin of this repository: the root manifest and each held workspace package's.
 *
 * @returns {Promise<readonly Pin[]>} The pins.
 */
async function pins(): Promise<readonly Pin[]> {
  const listed = await tracked();
  const texts = await textsOf(listed.filter((path) => path === 'package.json' || (held(path) && path.endsWith('/package.json'))));
  const manifests = texts.map(([path, text]: readonly [string, string]) => ({
    importer: path === 'package.json' ? '.' : path.replace(MANIFEST_SUFFIX, ''),
    manifest: json(text),
  }));
  const lockText = await textOf(LOCKFILE);
  return pinned(manifests, lockText);
}

export { pinned, pins, UPSTREAM };
export type { Pin };
