/**
 * The module boundaries hold under oxlint: one import that must fail and one that must pass per boundary.
 *
 * The layered direction (ADR-0005): foundation imports nothing from the rebuild; a system imports
 * only foundation; an experience imports foundation and systems, never another experience; nothing
 * in the rebuild imports the POC. The reducer-purity rule (ADR-0007) refuses `Date` and
 * `Math.random` in a system's reducer surface. Each fixture is written at its real path in a planted
 * project holding a copy of `.oxlintrc.json`, and every system package has its own override.
 */

import { describe, expect, test } from 'vitest';
import { json, object } from '#lib/config.ts';
import { textOf, tracked } from '#lib/source-files.ts';
import { EXIT_FINDINGS } from './exit-status.ts';
import { OXLINT_CONFIG_FILES } from '#lib/lint-rules.ts';
import { Project } from '#lib/tools.ts';

const HARNESS_ID = 'boundaries';

const SYSTEM_MANIFEST = /^packages\/systems\/(?<name>[^/]+)\/package\.json$/u;
/** The boundary rules are only proven with more than one system. */
const ONE_SYSTEM = 1;

interface Fixture {
  readonly path: string;
  readonly text: string;
  readonly fails: boolean;
}

const FIXTURES: readonly Fixture[] = [
  { fails: true, path: 'packages/foundation/src/plant.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  { fails: false, path: 'packages/foundation/src/near.ts', text: "export { Story } from 'inkjs';\n" },
  { fails: true, path: 'packages/systems/cards/src/plant.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  { fails: false, path: 'packages/systems/cards/src/near.ts', text: "export { erase } from '@narratives/foundation';\n" },
  { fails: true, path: 'packages/systems/chat/src/plant.ts', text: "export * from '../../cards/src/system';\n" },
  { fails: false, path: 'packages/systems/chat/src/near.ts', text: "export * from './state';\n" },
  { fails: true, path: 'experiences/sandbox/src/plant.ts', text: "export * from '../../aricanga/src/aricanga-experience.js';\n" },
  { fails: false, path: 'experiences/sandbox/src/near.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  { fails: true, path: 'harness/lib/plant.ts', text: "export * from '@narratives/framework';\n" },
  { fails: false, path: 'harness/lib/near.ts', text: "export * from 'node:fs';\n" },
  { fails: true, path: 'packages/systems/chat/src/model/plant.ts', text: 'export const at = (): number => Date.now();\n' },
  { fails: true, path: 'packages/systems/chat/src/model/random.ts', text: 'export const id = (): number => Math.random();\n' },
  { fails: false, path: 'packages/systems/chat/src/state-near.ts', text: 'export const at = (): number => Date.now();\n' },
];

const BOUNDARY_RULES = ['no-restricted-imports', 'no-restricted-globals', 'no-restricted-properties'];

/**
 * The boundary findings oxlint reports for each fixture path, under a copy of the repository config.
 *
 * @param {readonly Fixture[]} fixtures - The fixtures.
 * @returns {ReadonlyMap<string, boolean>} The boundary findings oxlint reports for each fixture path, under a copy of the repository config.
 */
function verdicts(fixtures: readonly Fixture[]): ReadonlyMap<string, boolean> {
  const project = new Project({ copies: OXLINT_CONFIG_FILES });
  try {
    for (const fixture of fixtures) {
      project.write(fixture.path, fixture.text);
    }
    const outcome = project.tool(
      'oxlint',
      '-c',
      '.oxlintrc.json',
      '-A',
      'all',
      ...fixtures.map((fixture) => fixture.path),
    );
    if (outcome.status > EXIT_FINDINGS || outcome.stderr.trim() !== '') {
      throw new Error(`oxlint did not lint the fixtures: ${outcome.status} ${outcome.stderr}`);
    }
    return new Map(
      fixtures.map((fixture) => [
        fixture.path,
        outcome.stdout
          .split('\n')
          .some((line) => line.startsWith(`${fixture.path}:`) && BOUNDARY_RULES.some((rule) => line.includes(`(${rule})`))),
      ]),
    );
  } finally {
    project.remove();
  }
}

/**
 * The system packages of the listing.
 *
 * @returns {readonly string[]} The system packages of the listing.
 */
function systems(): readonly string[] {
  return [...new Set(tracked().flatMap((path) => SYSTEM_MANIFEST.exec(path)?.groups?.['name'] ?? []))];
}

/**
 * The file globs of every override of the repository's oxlint config.
 *
 * @returns {readonly unknown[]} The globs.
 */
function overrideGlobs(): readonly unknown[] {
  const { overrides } = object(json(textOf('.oxlintrc.json')), '.oxlintrc.json');
  const entries: readonly unknown[] = Array.isArray(overrides) ? overrides : [];
  return entries.flatMap((entry) => object(entry, 'override')['files']);
}

describe('the boundary lint', () => {
  test('fails each must-fail fixture and passes each must-pass fixture', () => {
    expect.hasAssertions();
    const found = verdicts(FIXTURES);
    expect(FIXTURES.map((fixture) => [fixture.path, found.get(fixture.path)])).toStrictEqual(
      FIXTURES.map((fixture) => [fixture.path, fixture.fails]),
    );
  });

  test('every system package has its own import override', () => {
    expect.hasAssertions();
    const globs = overrideGlobs();
    expect(systems().filter((name) => !globs.includes(`packages/systems/${name}/**`))).toStrictEqual([]);
    expect(systems().length).toBeGreaterThan(ONE_SYSTEM);
  });
});

export { HARNESS_ID };
