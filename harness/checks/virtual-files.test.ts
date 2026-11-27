/**
 * The session's virtual file system answers what is mounted now. A mount of a path the disk holds is
 * refused, since every project opened while it stands would read it; `overlaying` serves such a path for
 * one synchronous run alone and refuses a run that awaits.
 */

import { describe, expect, test } from 'vitest';
import { REPO_ROOT } from '#lib/paths.ts';
import { VirtualFiles } from '#lib/virtual-files.ts';
import path from 'node:path';

/** A path the disk holds, and a directory it does not. */
const REAL = path.join(REPO_ROOT, 'harness', 'lib', 'present.ts');
const ABSENT = path.join(REPO_ROOT, '.harness-scan', 'virtual-files-test');

describe('an overlay of a path the disk holds', () => {
  test('is refused as a mount, beside a path the disk does not hold, and none of them is served', () => {
    expect.hasAssertions();
    const files = new VirtualFiles();
    const planted = path.join(ABSENT, 'planted.ts');
    expect(() =>
      files.mount(
        new Map([
          [planted, 'export {};\n'],
          [REAL, 'export const overlay = 1;\n'],
        ]),
      ),
    ).toThrow(`the session mounts no path the disk holds (${REAL})`);
    expect([files.served(planted), files.served(REAL)]).toStrictEqual([undefined, undefined]);
  });

  test('is served inside the run of overlaying alone, and as the disk has it after', () => {
    expect.hasAssertions();
    const files = new VirtualFiles();
    const inside = files.overlaying(new Map([[REAL, 'export const overlay = 1;\n']]), () => files.served(REAL));
    expect([inside, files.served(REAL)]).toStrictEqual(['export const overlay = 1;\n', undefined]);
  });

  test('refuses a run that returns a promise, its overlay gone', () => {
    expect.hasAssertions();
    const files = new VirtualFiles();
    const later = async (): Promise<string | undefined> => {
      await Promise.resolve();
      return files.served(REAL);
    };
    expect((): unknown => files.overlaying(new Map([[REAL, 'export const overlay = 1;\n']]), later)).toThrow(
      'an overlay is served for one synchronous run',
    );
    expect(files.served(REAL)).toBeUndefined();
  });
});
