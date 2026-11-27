/**
 * The session's virtual file system answers what is mounted now. A mount of a path the disk holds is
 * refused, since every project opened while it stands would read it; `overlaying` serves such a path for
 * one synchronous run alone and refuses a run that awaits. A directory is held while it holds a served
 * path, by its spelling or through a symlinked directory read afresh at each mount; every path whose
 * answer may have changed is marked, the declaration beside a mounted file included, and the rule
 * declares no file the disk already declares.
 */

import { describe, expect, test } from 'vitest';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { REPO_ROOT } from '#lib/paths.ts';
import { VirtualFiles } from '#lib/virtual-files.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

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

describe('the declaration rule', () => {
  test('tells each declaration asked of it once, as it turns off, and none again at its next run', () => {
    expect.hasAssertions();
    const files = new VirtualFiles();
    const declaration = path.join(ABSENT, 'asked', 'sheet.d.css.ts');
    const unmount = files.mount(new Map([[path.join(ABSENT, 'asked', 'sheet.css'), 'a {}\n']]));
    const served = files.declaringWhile(() => files.served(declaration));
    const toldAfter = files.takeChanged().includes(declaration);
    const toldAgain = files.declaringWhile(() => files.takeChanged());
    unmount();
    expect([served, toldAfter, toldAgain]).toStrictEqual(['export {};\n', true, []]);
  });
});

describe('the records of what is served', () => {
  test('hold a directory while it holds a served path, and not once its last one is unmounted', () => {
    expect.hasAssertions();
    const files = new VirtualFiles();
    const unmount = files.mount(new Map([[path.join(ABSENT, 'held', 'deep', 'x.ts'), 'export {};\n']]));
    const held = [files.holdsServed(path.join(ABSENT, 'held')), files.holdsServed(path.join(ABSENT, 'held', 'deep'))];
    unmount();
    expect([...held, files.holdsServed(path.join(ABSENT, 'held')), files.holdsServed(path.join(ABSENT, 'held', 'deep'))]).toStrictEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  test("mark the declaration beside a mounted file, and at the rule's entry each declaration asked while it was off", () => {
    expect.hasAssertions();
    const files = new VirtualFiles();
    const declaration = path.join(ABSENT, 'marked', 'sheet.d.css.ts');
    const unmount = files.mount(new Map([[path.join(ABSENT, 'marked', 'sheet.css'), 'a {}\n']]));
    const atMount = files.takeChanged().includes(declaration);
    const offAnswer = files.served(declaration);
    const atEntry = files.declaringWhile(() => files.takeChanged());
    unmount();
    expect([atMount, offAnswer, atEntry]).toStrictEqual([true, undefined, [declaration]]);
  });
});

/**
 * Run `run` in a folder of its own on disk, removed after it.
 *
 * @param {(folder: string) => Promise<Result>} run - What uses the folder.
 * @returns {Promise<Result>} What `run` returns.
 */
async function inFolder<Result>(run: (folder: string) => Promise<Result>): Promise<Result> {
  const folder = await mkdtemp(path.join(tmpdir(), 'virtual-files-'));
  try {
    return await run(folder);
  } finally {
    await rm(folder, { force: true, recursive: true });
  }
}

/**
 * Point `link` at `target`, replacing the link it was.
 *
 * @param {string} link - The link's path.
 * @param {string} target - The directory it names.
 */
async function relink(link: string, target: string): Promise<void> {
  await rm(link, { force: true });
  await symlink(target, link, 'dir');
}

/**
 * What one mount at `target` answers through `link`: whether the directory sub below it holds a served path, and
 * the text of the module f.ts in it.
 *
 * @param {string} link - A symlinked directory naming `target`.
 * @param {string} target - Its target.
 * @param {Readonly<VirtualFiles>} files - The virtual file system.
 * @returns {readonly unknown[]} The two answers.
 */
function mountedThrough(link: string, target: string, files: Readonly<VirtualFiles>): readonly unknown[] {
  const unmount = files.mount(
    new Map([
      [path.join(target, 'sub', 'x.ts'), 'export {};\n'],
      [path.join(target, 'f.ts'), `export const at = '${path.basename(target)}';\n`],
    ]),
  );
  const answers = [files.holdsServed(path.join(link, 'sub')), files.served(path.join(link, 'f.ts'))];
  unmount();
  return answers;
}

/**
 * What a directory through a symlinked one answers at a mount, then at a mount after the link is
 * pointed at another directory.
 *
 * @param {string} folder - A folder of its own.
 * @returns {Promise<readonly unknown[]>} The answers of each mount.
 */
async function throughLinks(folder: string): Promise<readonly unknown[]> {
  const link = path.join(folder, 'link');
  const first = path.join(folder, 'first');
  const second = path.join(folder, 'second');
  await Promise.all([mkdir(first), mkdir(second)]);
  const files = new VirtualFiles();
  await relink(link, first);
  const before = mountedThrough(link, first, files);
  await relink(link, second);
  return [...before, ...mountedThrough(link, second, files)];
}

/**
 * What the rule answers beside a stylesheet declared on disk, and beside a mounted one that is not.
 *
 * @param {string} folder - A folder of its own.
 * @returns {Promise<readonly unknown[]>} The two declarations' texts.
 */
async function declaredOnDisk(folder: string): Promise<readonly unknown[]> {
  await writeFile(path.join(folder, 'sheet.css'), '.a {}\n');
  await writeFile(path.join(folder, 'sheet.d.css.ts'), 'export declare const tone: string;\n');
  const files = new VirtualFiles();
  const unmount = files.mount(new Map([[path.join(folder, 'other.css'), '.b {}\n']]));
  const answers = files.declaringWhile(() => [
    files.served(path.join(folder, 'sheet.d.css.ts')),
    files.served(path.join(folder, 'other.d.css.ts')),
  ]);
  unmount();
  return answers;
}

describe('the disk beneath the served paths', () => {
  test('a directory holds a served path through a symlinked directory, read afresh when the link changes between mounts', async () => {
    expect.hasAssertions();
    await expect(inFolder(throughLinks)).resolves.toStrictEqual([
      true,
      "export const at = 'first';\n",
      true,
      "export const at = 'second';\n",
    ]);
  });

  test('a declaration on disk beside a stylesheet is read as the disk has it, never declared by the rule', async () => {
    expect.hasAssertions();
    await expect(inFolder(declaredOnDisk)).resolves.toStrictEqual([undefined, 'export {};\n']);
  });
});
