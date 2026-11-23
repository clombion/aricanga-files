/**
 * The pinned tools, each with its upstream repository, where it is pinned, and its pin; and the
 * lockfile read once, by importer, for the pins and for the population's independent check
 * (`harness/checks/scope.test.ts`).
 *
 * The pins are the root `package.json`'s dependencies and devDependencies and each member's
 * devDependencies, each at the version `pnpm-lock.yaml` locks under that package's importer, plus
 * Node's `engines.node` floor and pnpm's `packageManager`. The manifests read are the population's:
 * the root and the members, never another listed `package.json`. A tool locked at two versions is
 * two pins. `UPSTREAM` names each tool's repository; the tool-upgrades check fails on a pin it does
 * not name (`upstream.ts`), on a pin with no version and on a row that pins nothing, and `harness/lib/generated.ts`
 * renders the table of `harness.md`.
 */

import { ConfigError, object, report } from './config.ts';
import type { Dir, Population } from './scope.ts';
import { importerOf, manifestOf, population } from './scope.ts';
import { engineRange } from './node-floor.ts';
import { isEmpty } from './lists.ts';
import { parse } from 'yaml';
import { present } from './present.ts';
import { textOf } from './source-files.ts';

/** A pinned tool: its name, its version (none when nothing holds one), and every input that pins it at that version. */
interface Pin {
  readonly tool: string;
  readonly where: readonly string[];
  readonly version: string | undefined;
}

/** One input's pin of a tool: the file, and the lockfile importers it is pinned under (none for a `package.json` field). */
interface Found {
  readonly tool: string;
  readonly version: string | undefined;
  readonly file: string;
  readonly importers: readonly string[];
}

/** A workspace package's parsed manifest, by its directory. */
interface Manifest {
  readonly dir: Dir;
  readonly manifest: unknown;
}

/** A lockfile read once: each importer's resolved versions, by package name, by importer. */
type Lock = ReadonlyMap<string, ReadonlyMap<string, string>>;

const LOCKFILE = 'pnpm-lock.yaml';
const WORKSPACE = 'workspace:';

const PNPM_PREFIX = /^pnpm@/u;

/** What joins a pin's tool and version in its key: below every character a name or version holds. */
const KEY_SEPARATOR = '\u0000';

/** A group's first input. */
const FIRST = 0;

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
 * A lockfile's text read as YAML's failsafe schema, so every key and version is the string pnpm
 * wrote (`1.0` stays `1.0`), refusing text that is not YAML by naming the lockfile.
 *
 * @param {string} lockText - The lockfile's text.
 * @returns {unknown} The parsed value.
 */
function yamlOf(lockText: string): unknown {
  try {
    return parse(lockText, { schema: 'failsafe' });
  } catch (error: unknown) {
    throw new ConfigError(`${LOCKFILE} is not YAML: ${String(error)}`, { cause: error });
  }
}

/**
 * The resolved versions of one importer, by package name, without their peers, from every dependency
 * group pnpm writes (`LOCK_GROUPS`). The importer's other fields (`publishDirectory`,
 * `dependenciesMeta`) are not read. An entry with no `version` is left out, so its pin reads as one
 * with no version, the same as a package the lockfile does not hold.
 *
 * @param {string} importer - The importer, for a refusal.
 * @param {unknown} value - The importer's mapping.
 * @returns {ReadonlyMap<string, string>} Each package's resolved version, by name.
 */
function lockedVersions(importer: string, value: unknown): ReadonlyMap<string, string> {
  const fields = object(value, `${LOCKFILE} ${importer}`);
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
 * A pnpm lockfile read once: one entry per importer `pnpm install` wrote, `.` for the root, each as
 * the directory pnpm names it, with its resolved versions. Text that is not YAML (a merge conflict, a
 * duplicate key) and a lockfile with no `importers` mapping refuse with `ConfigError`.
 *
 * @param {string} lockText - The lockfile's text.
 * @returns {Lock} Each importer's versions.
 */
function lockOf(lockText: string): Lock {
  const lock = object(yamlOf(lockText), LOCKFILE);
  const importers = object(lock['importers'], `${LOCKFILE} importers`);
  return new Map(
    Object.entries(importers).map(([importer, value]: readonly [string, unknown]) => [importer, lockedVersions(importer, value)]),
  );
}

/**
 * The root manifest's pins beyond its dependencies: Node's floor and pnpm's `packageManager`.
 *
 * @param {unknown} manifest - The root `package.json`.
 * @returns {readonly Found[]} The two pins.
 */
function rootPins(manifest: unknown): readonly Found[] {
  const { packageManager } = object(manifest, 'package.json');
  return [
    { file: 'package.json engines', importers: [], tool: 'node', version: engineRange(manifest) },
    {
      file: 'package.json packageManager',
      importers: [],
      tool: 'pnpm',
      version: typeof packageManager === 'string' ? packageManager.replace(PNPM_PREFIX, '') : undefined,
    },
  ];
}

/**
 * The pins of one manifest at the versions the lockfile holds under its importer.
 *
 * @param {Manifest} entry - The manifest and its directory.
 * @param {Lock} lock - The lockfile, read once.
 * @returns {readonly Found[]} Its pins.
 */
function manifestPins(entry: Manifest, lock: Lock): readonly Found[] {
  const { dir, manifest } = entry;
  const fields = object(manifest, manifestOf(dir));
  const groups = dir === '' ? ['dependencies', 'devDependencies'] : ['devDependencies'];
  const versions = lock.get(importerOf(dir));
  const dependencies = groups.flatMap((group) =>
    Object.entries(strings(fields[group], `${manifestOf(dir)} ${group}`))
      .filter(([, specifier]: readonly [string, string]) => !specifier.startsWith(WORKSPACE))
      .map(([tool]: readonly [string, string]): Found => ({
        file: LOCKFILE,
        importers: [importerOf(dir)],
        tool,
        version: versions?.get(tool),
      })),
  );
  return dir === '' ? [...dependencies, ...rootPins(manifest)] : dependencies;
}

/**
 * A found pin's key: its tool, then its version.
 *
 * @param {Found} input - The found pin.
 * @returns {string} Its key.
 */
function keyOf(input: Found): string {
  return `${input.tool}${KEY_SEPARATOR}${input.version ?? ''}`;
}

/**
 * The inputs of one (tool, version), as a pin's `where`: each file once, a lockfile with the importers
 * that pin the tool under it (`pnpm-lock.yaml (., packages/app)`), ordered by code unit.
 *
 * @param {readonly Found[]} found - The inputs' pins of one tool at one version.
 * @returns {readonly string[]} The inputs.
 */
function inputsOf(found: readonly Found[]): readonly string[] {
  const files = [...new Set(found.map((input) => input.file))].toSorted();
  return files.map((file) => {
    const importers = [...new Set(found.filter((input) => input.file === file).flatMap((input) => input.importers))].toSorted();
    return isEmpty(importers) ? file : `${file} (${importers.join(', ')})`;
  });
}

/**
 * Every pin of the given manifests at the versions the lockfile holds: one per tool and version, so
 * a tool locked at two versions is two pins, each naming every input that pins it at its version;
 * ordered by tool, then version.
 *
 * @param {readonly Manifest[]} manifests - The manifests.
 * @param {string} lockText - The lockfile's text, read once here.
 * @returns {readonly Pin[]} The pins.
 */
function pinned(manifests: readonly Manifest[], lockText: string): readonly Pin[] {
  const lock = lockOf(lockText);
  const found = manifests.flatMap((entry) => manifestPins(entry, lock));
  const byKey = new Map(found.map((input) => [keyOf(input), found.filter((other) => keyOf(other) === keyOf(input))] as const));
  return [...byKey.entries()]
    .toSorted(([first]: readonly [string, readonly Found[]], [second]: readonly [string, readonly Found[]]) => first.localeCompare(second))
    .map(([, inputs]: readonly [string, readonly Found[]]): Pin => {
      const { tool, version } = present(inputs.at(FIRST), 'a pin of its own key');
      return { tool, version, where: inputsOf(inputs) };
    });
}

/**
 * The pins of a population: the root's manifest and each member's, at the versions the lockfile holds.
 *
 * @param {Population} held - The population.
 * @param {(listed: string) => Promise<string>} read - Reads a listed file's text.
 * @returns {Promise<readonly Pin[]>} The pins.
 */
async function pinsOf(held: Population, read: (listed: string) => Promise<string>): Promise<readonly Pin[]> {
  const dirs: readonly Dir[] = ['', ...held.members.map((member) => member.dir)];
  const [manifests, lockText] = await Promise.all([
    Promise.all(
      dirs.map(async (dir): Promise<Manifest> => {
        const text = await read(manifestOf(dir));
        return { dir, manifest: report(text, manifestOf(dir)) };
      }),
    ),
    read(LOCKFILE),
  ]);
  return pinned(manifests, lockText);
}

/**
 * Every pin of this repository.
 *
 * @returns {Promise<readonly Pin[]>} The pins.
 */
async function pins(): Promise<readonly Pin[]> {
  const held = await population();
  const found = await pinsOf(held, async (listed: string): Promise<string> => {
    const text = await textOf(listed);
    return text;
  });
  return found;
}

export { LOCKFILE, lockOf, pinned, pins, pinsOf };
export type { Pin };
