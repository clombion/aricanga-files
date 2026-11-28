/**
 * Every held module is one holder's code (`Population.holderOf`), and every reader of whose code a module is gives that answer.
 *
 * The holder is the module's nearest member, or else the harness, which holds `harness/` and the root
 * configuration modules; a member at `harness/` is refused, since its files would have two holders,
 * and a member under it is nested in the harness and holds its own files (#58 1c refuses nesting,
 * under the harness's directory included). Each reader gives the holder's answer, run as the reader runs: oxlint's harness code (`HARNESS_CODE`), knip's
 * root project (the harness's directory; knip enters the root configuration modules itself, as its
 * config and its plugins' configs), the owner registry's roots (`rootOf`) and jscpd's roots
 * (`scanRoots`), which take each module once.
 */

import { describe, test } from 'vitest';
import { fieldMatches, matches } from '#lint-rules/globs.ts';
import { harnessModules, heldDir } from '#lib/holders.ts';
import { listing, manifest, reader, refusalOf } from './scope.plants.ts';
import { population, populationOf, typescriptOf } from '#lib/scope.ts';
import { rootOf, rulesOf } from '#lib/owner-rules.ts';
import { HARNESS_CODE } from '#lib/oxlint-files.ts';
import type { Population } from '#lib/scope.ts';
import { knipConfigOf } from '#lib/knip-config.ts';
import { present } from '#lib/present.ts';
import { scanRoots } from '#lib/dupes.ts';

const HARNESS_ID = 'holders';

/** A path taken once: by exactly one of jscpd's roots. */
const ONCE = 1;

/**
 * The held modules the owner registry gives a root other than their holder's, in some rule.
 *
 * @param {Population} held - The population.
 * @returns {readonly string[]} The modules.
 */
function misrooted(held: Population): readonly string[] {
  const rules = rulesOf(held);
  return typescriptOf(held).filter((file) =>
    rules.some((rule) => rootOf(rule, held)(file)?.root !== heldDir(present(held.holderOf(file), `the holder of ${file}`))),
  );
}

/**
 * The held modules jscpd's roots take other than once: as a directory holding them, or by name.
 *
 * @param {Population} held - The population.
 * @returns {readonly string[]} The modules.
 */
function notOnce(held: Population): readonly string[] {
  const roots = scanRoots(held);
  return typescriptOf(held).filter((file) => roots.filter((root) => root === file || file.startsWith(`${root}/`)).length !== ONCE);
}

/** Paths whose holders a population answers: a member's, a harness module, a root configuration module, a root file, the POC's. */
const HOLDER_PROBES: readonly string[] = [
  'packages/view/src/a.ts',
  'harness/lib/a.ts',
  'knip.config.ts',
  'package.json',
  'packages/framework/src/a.ts',
];

describe("a population's holders", () => {
  test("gives a path to its member, the harness's directory and the root configuration modules to the harness, and others to none", async ({
    expect,
  }) => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['package.json', 'packages/view/package.json', 'packages/framework/package.json'],
      read: reader({ 'package.json': '{}', 'packages/view/package.json': manifest('view') }),
      workspace: listing([''], ['packages/view/', 'x'], ['packages/framework/']),
    });
    const holders = HOLDER_PROBES.map((probe) => held.holderOf(probe));
    expect(holders).toStrictEqual([...held.members, 'harness', 'harness', undefined, undefined]);
  });

  test("gives a member under the harness's directory its own files, nested in the harness, and the harness the rest of its directory", async ({
    expect,
  }) => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['package.json', 'harness/tools/package.json'],
      read: reader({ 'harness/tools/package.json': manifest('system'), 'package.json': '{}' }),
      workspace: listing([''], ['harness/tools/', 'x']),
    });
    expect(['harness/tools/src/a.ts', 'harness/lib/a.ts'].map((path) => held.holderOf(path))).toStrictEqual([...held.members, 'harness']);
  });

  test("refuses a member at the harness's root, whose files would be its own and the harness's", async ({ expect }) => {
    expect.hasAssertions();
    const building = populationOf({
      listing: ['package.json', 'harness/package.json'],
      read: reader({ 'harness/package.json': manifest('experience'), 'package.json': '{}' }),
      workspace: listing([''], ['harness/', 'x']),
    });
    await expect(refusalOf(building)).resolves.toBe(
      "PopulationError: a member sits at the harness's root, harness/: its files would be its own and the harness's",
    );
  });
});

describe('the repository', () => {
  test("every reader of whose code a held module is gives its holder's answer", async ({ expect }) => {
    expect.hasAssertions();
    const held = await population();
    const files = typescriptOf(held);
    const harness = harnessModules(held);
    const knipRoot = present(knipConfigOf(held).workspaces['.'], "knip's root workspace").project;
    expect([
      files.filter((file) => HARNESS_CODE.some((glob) => fieldMatches('files', glob, file))),
      files.filter((file) => knipRoot.some((glob) => matches(glob, file))),
      misrooted(held),
      notOnce(held),
    ]).toStrictEqual([harness, harness.filter((file) => file.startsWith(heldDir('harness'))), [], []]);
  });
});

export { HARNESS_ID };
