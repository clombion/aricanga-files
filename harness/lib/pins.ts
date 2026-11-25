/**
 * The pinned tools, each with its upstream repository, where it is pinned, and its pin; and the
 * lockfile read once, by importer, for the pins and for the population's independent check
 * (`harness/checks/scope.test.ts`).
 *
 * The pins are the root `package.json`'s dependencies and devDependencies and each member's
 * devDependencies, each at the version `pnpm-lock.yaml` locks under that package's importer, plus
 * Node's `engines.node` floor and pnpm's `packageManager`. The manifests read are the population's,
 * as it read them at one moment: the root's and the members', never another listed `package.json`. A tool locked at two versions is
 * two pins. `UPSTREAM` names each tool's repository; the tool-upgrades check fails on a pin it does
 * not name (`upstream.ts`), on a pin with no version and on a row that pins nothing, and `harness/lib/generated.ts`
 * renders the table of `harness.md`.
 */

import { ConfigError, absentAs, object, stringOf, stringRecord } from './config.ts';
import { byCodeUnit, isEmpty } from './lists.ts';
import { importerOf, manifestOf } from './package-dirs.ts';
import type { Dir } from './package-dirs.ts';
import type { Fields } from './manifests.ts';
import type { Population } from './scope.ts';
import { engineRange } from './node-floor.ts';
import { parse } from 'yaml';
import { population } from './scope.ts';
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

/** A workspace package's manifest, as the population read it (a JSON object), by its directory. */
interface DirManifest {
  readonly dir: Dir;
  readonly manifest: Fields;
}

/** A lockfile read once: each importer's resolved versions, by package name, by importer. */
type Lock = ReadonlyMap<string, ReadonlyMap<string, string>>;

const LOCKFILE = 'pnpm-lock.yaml';
const WORKSPACE = 'workspace:';

const PNPM_PREFIX = /^pnpm@/u;

/**
 * The dependency groups pnpm writes in a lockfile importer (pnpm's `DEPENDENCIES_FIELDS`). A package a
 * manifest lists in two groups is written once, in the group pnpm resolves it to (optional over dev),
 * so a pin is looked up in every group, whatever group its manifest lists it in.
 */
const LOCK_GROUPS: readonly string[] = ['optionalDependencies', 'dependencies', 'devDependencies'];

/** The peers pnpm appends to a resolved version: `1.0.3(peer@2.0.0)`. */
const PEERS = /\(.*$/u;

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
 * A version as a lockfile, `packageManager` or `engines.node` writes it, refusing an empty one: no writer means "no
 * version" by `''`, so a pin with no version is one no input holds a version for.
 *
 * @param {string} version - The written version.
 * @param {string} what - Where it is written, for the refusal.
 * @returns {string} The version.
 */
function versionOf(version: string, what: string): string {
  if (version === '') {
    throw new ConfigError(`${what} is an empty version`);
  }
  return version;
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
      Object.entries(object(absentAs(fields[group], {}), `${LOCKFILE} ${importer} ${group}`)).flatMap(
        ([name, entry]: readonly [string, unknown]) => {
          const where = `${LOCKFILE} ${importer} ${group} ${name}`;
          const { version } = object(entry, where);
          return version === undefined ? [] : [[name, versionOf(stringOf(version, where).replace(PEERS, ''), where)] as const];
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
 * @param {Fields} manifest - The root `package.json`.
 * @returns {readonly Found[]} The two pins.
 */
function rootPins(manifest: Fields): readonly Found[] {
  const { packageManager } = manifest;
  const floor = engineRange(manifest);
  const pnpm = 'package.json packageManager';
  return [
    {
      file: 'package.json engines',
      importers: [],
      tool: 'node',
      version: floor === undefined ? undefined : versionOf(floor, 'package.json engines.node'),
    },
    {
      file: pnpm,
      importers: [],
      tool: 'pnpm',
      version: packageManager === undefined ? undefined : versionOf(stringOf(packageManager, pnpm).replace(PNPM_PREFIX, ''), pnpm),
    },
  ];
}

/**
 * The pins of one manifest at the versions the lockfile holds under its importer.
 *
 * @param {DirManifest} entry - The manifest and its directory.
 * @param {Lock} lock - The lockfile, read once.
 * @returns {readonly Found[]} Its pins.
 */
function manifestPins(entry: DirManifest, lock: Lock): readonly Found[] {
  const { dir, manifest: fields } = entry;
  const groups = dir === '' ? ['dependencies', 'devDependencies'] : ['devDependencies'];
  const versions = lock.get(importerOf(dir));
  const dependencies = groups.flatMap((group) =>
    Object.entries(stringRecord(absentAs(fields[group], {}), `${manifestOf(dir)} ${group}`))
      .filter(([, specifier]: readonly [string, string]) => !specifier.startsWith(WORKSPACE))
      .map(([tool]: readonly [string, string]): Found => ({
        file: LOCKFILE,
        importers: [importerOf(dir)],
        tool,
        version: versions?.get(tool),
      })),
  );
  return dir === '' ? [...dependencies, ...rootPins(fields)] : dependencies;
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
 * Order two keyed entries by their keys, by code unit.
 *
 * @param {readonly [string, unknown]} left - An entry.
 * @param {readonly [string, unknown]} right - Another entry.
 * @returns {number} Their order.
 */
function byKey([left]: readonly [string, unknown], [right]: readonly [string, unknown]): number {
  return byCodeUnit(left, right);
}

/**
 * Every pin of the given manifests at the versions the lockfile holds: one per tool and version, so
 * a tool locked at two versions is two pins, each naming every input that pins it at its version.
 * The inputs are grouped by tool, then by version, where no version is a key of its own; the pins
 * are ordered by tool, then version, by code unit, no version first.
 *
 * @param {readonly DirManifest[]} manifests - The manifests.
 * @param {string} lockText - The lockfile's text, read once here.
 * @returns {readonly Pin[]} The pins.
 */
function pinned(manifests: readonly DirManifest[], lockText: string): readonly Pin[] {
  const lock = lockOf(lockText);
  const byTool = new Map<string, Map<string | undefined, readonly Found[]>>();
  for (const input of manifests.flatMap((entry) => manifestPins(entry, lock))) {
    const byVersionOf = byTool.get(input.tool) ?? new Map<string | undefined, readonly Found[]>();
    byVersionOf.set(input.version, [...(byVersionOf.get(input.version) ?? []), input]);
    byTool.set(input.tool, byVersionOf);
  }
  return [...byTool.entries()]
    .toSorted(byKey)
    .flatMap(([tool, versions]: readonly [string, ReadonlyMap<string | undefined, readonly Found[]>]) => {
      const entries = [...versions.entries()];
      const unversioned = entries.filter(([version]: readonly [string | undefined, readonly Found[]]) => version === undefined);
      const locked = entries
        .flatMap(([version, inputs]: readonly [string | undefined, readonly Found[]]) =>
          version === undefined ? [] : [[version, inputs] as const],
        )
        .toSorted(byKey);
      return [...unversioned, ...locked].map(([version, inputs]: readonly [string | undefined, readonly Found[]]): Pin => ({
        tool,
        version,
        where: inputsOf(inputs),
      }));
    });
}

/**
 * The pins of a population: its root manifest and each member's, as the population read them, at the
 * versions the lockfile holds.
 *
 * @param {Population} held - The population.
 * @param {(listed: string) => Promise<string>} read - Reads a listed file's text: the lockfile.
 * @returns {Promise<readonly Pin[]>} The pins.
 */
async function pinsOf(held: Population, read: (listed: string) => Promise<string>): Promise<readonly Pin[]> {
  const manifests: readonly DirManifest[] = [
    { dir: '', manifest: held.rootManifest },
    ...held.members.map((member): DirManifest => ({ dir: member.dir, manifest: member.manifest })),
  ];
  const lockText = await read(LOCKFILE);
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
