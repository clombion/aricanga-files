/** The scan's readers: a path it does not cover is refused, and a missing symbol has no name. */

import { describe, expect, test } from 'vitest';
import { qualifiedName, scanOver, sourceOf } from '#lib/checker.ts';
import type { ScanOpening } from '#lib/checker.ts';
import { present } from '#lib/present.ts';
import { usePlanted } from '#lib/scan-hooks.ts';

/** A session's projects, by project file: this one holds none. */
const NO_PROJECTS = new Map<string, ReturnType<ScanOpening['open']>>();

/**
 * A scan opening whose session holds no project, recording what it mounted, opened and released.
 *
 * @param {Pick<string[], 'push'>} events - Where each step is recorded, in order.
 * @returns {ScanOpening} The opening.
 */
function noProject(events: Readonly<Pick<string[], 'push'>>): ScanOpening {
  return {
    mount: () => {
      events.push('mount');
      return (): void => {
        events.push('unmount');
      };
    },
    open: () => {
      events.push('open');
      return NO_PROJECTS.get('planted');
    },
    paths: [],
    release: () => {
      events.push('release');
    },
  };
}

const scan = usePlanted(new Map([['planted/one.ts', 'export const one = 1;\n']]));

describe('a scan', () => {
  test('refuses a path it does not cover, naming it', () => {
    expect.hasAssertions();
    expect(() => sourceOf(scan(), 'planted/two.ts')).toThrow('the scan does not cover planted/two.ts');
  });

  test('gives a missing symbol no qualified name', () => {
    expect.hasAssertions();
    const [statement] = sourceOf(scan(), 'planted/one.ts').statements;
    const { checker } = scan();
    const symbol = checker.getSymbolAtLocation(present(statement, 'the planted statement'));
    expect(qualifiedName(checker, symbol)).toBeUndefined();
  });

  test('refused for a project the session lacks, releases the project and unmounts its files', () => {
    expect.hasAssertions();
    const events: string[] = [];
    expect(() => scanOver(noProject(events))).toThrow('the scan project');
    expect(events).toStrictEqual(['mount', 'open', 'release', 'unmount']);
  });
});
