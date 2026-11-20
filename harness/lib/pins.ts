/**
 * The pinned tools: each with its upstream repository, where it is pinned, and its pin.
 *
 * The pins are the root `package.json`'s dependencies and devDependencies and the devDependencies
 * of every held workspace package, each at the version `pnpm-lock.yaml` holds, plus Node's
 * `engines.node` floor and pnpm's `packageManager`. `UPSTREAM` names each tool's repository; the
 * tool-upgrades check fails on a pin it does not name and on a row that pins nothing, and
 * `harness/lib/generated.ts` renders the table of `harness.md`.
 */

import { ConfigError, json, object } from './config.ts';
import { textOf, textsOf, tracked } from './source-files.ts';
import { engineRange } from './node-floor.ts';
import { held } from './scope.ts';

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

const LOCKFILE = 'pnpm-lock.yaml';
const WORKSPACE = 'workspace:';

/** A top-level key of the lockfile, such as `importers:`. */
const TOP_LEVEL = /^\S/u;
const IMPORTER_LINE = /^ {2}(?<importer>\S.*):$/u;
const NAME_LINE = /^ {6}'?(?<name>[^':]+)'?:$/u;
const VERSION_LINE = /^ {8}version: (?<version>[^(\s]+)/u;
const PNPM_PREFIX = /^pnpm@/u;
const MANIFEST_SUFFIX = /\/package\.json$/u;

/** The index `findIndex` gives when nothing matches. */
const NOT_FOUND = -1;

/** The line after a header line. */
const NEXT_LINE = 1;

/** The index of a list's first item. */
const FIRST = 0;

/**
 * The lines of a block that starts after `start` and ends before the first line `ends` holds of.
 *
 * @param {readonly string[]} lines - The text's lines.
 * @param {number} start - The index of the block's header line.
 * @param {(line: string) => boolean} ends - Whether a line ends the block.
 * @returns {readonly string[]} The block's lines.
 */
function blockAfter(lines: readonly string[], start: number, ends: (line: string) => boolean): readonly string[] {
  if (start === NOT_FOUND) {
    return [];
  }
  const rest = lines.slice(start + NEXT_LINE);
  const end = rest.findIndex((line) => ends(line));
  return end === NOT_FOUND ? rest : rest.slice(FIRST, end);
}

/**
 * The versions an importer's block of the lockfile lists.
 *
 * @param {readonly string[]} block - The block's lines.
 * @returns {ReadonlyMap<string, string>} Each package's resolved version, by name.
 */
function versionsIn(block: readonly string[]): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  let name = '';
  for (const line of block) {
    name = NAME_LINE.exec(line)?.groups?.['name'] ?? name;
    const version = VERSION_LINE.exec(line)?.groups?.['version'];
    if (name !== '' && version !== undefined) {
      found.set(name, version);
    }
  }
  return found;
}

/**
 * The resolved versions of one importer of a pnpm lockfile, by package name. The lockfile is read
 * as the indented text pnpm writes: `importers:` → `  <importer>:` → `    <group>:` →
 * `      <name>:` → `        version: <version>(<peers>)`.
 *
 * @param {string} lockText - The lockfile's text.
 * @param {string} importer - The importer, `.` for the root.
 * @returns {ReadonlyMap<string, string>} Each package's resolved version, by name.
 */
function locked(lockText: string, importer: string): ReadonlyMap<string, string> {
  const lines = lockText.split('\n');
  const importers = blockAfter(lines, lines.indexOf('importers:'), (line) => TOP_LEVEL.test(line));
  const start = importers.findIndex((line) => IMPORTER_LINE.exec(line)?.groups?.['importer'] === importer);
  return versionsIn(blockAfter(importers, start, (line) => IMPORTER_LINE.test(line)));
}

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
  const versions = locked(lockText, importer);
  const groups = importer === '.' ? ['dependencies', 'devDependencies'] : ['devDependencies'];
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
