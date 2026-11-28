/**
 * The one TypeScript session serves what is mounted now: a path while some live mount holds it, as
 * the latest of them gives it, a directory while it holds such a path, and a path mounted again or a
 * real file overlaid for one run (`overlaying`) then released as it is now, though TypeScript's server
 * caches what it read. The
 * declaration rule holds while `declaring` runs, and for no project opened before or after.
 */

import type { Diagnostic, Program } from 'typescript/unstable/sync';
import { declaring, mount, nextName, overlaying, snapshot } from '#lib/ts-session.ts';
import { describe, test } from 'vitest';
import { REPO_ROOT } from '#lib/paths.ts';
import { byCodeUnit } from '#lib/lists.ts';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

/** One mount the generator keeps live: its files and how to unmount them. */
interface Live {
  readonly files: readonly string[];
  readonly unmount: () => void;
}

/** The planted files' directory, absent on disk, and the generator's below it. */
const BASE = path.join(REPO_ROOT, '.harness-scan', 'ts-session-test');
const POOL_DIR = path.join(BASE, 'pool');

/** A project's options: a scan's resolution, no `@types`. */
const OPTIONS = {
  allowImportingTsExtensions: true,
  module: 'esnext',
  moduleResolution: 'bundler',
  noEmit: true,
  strict: true,
  target: 'es2022',
  types: [],
};

/** The generator's pool: files a project lists, and a package a bare import reaches through its mounted directory. */
const LISTED = ['a/x.ts', 'a/y.ts', 'b/z.ts'].map((file) => path.join(POOL_DIR, file));
const PACKAGE = path.join(POOL_DIR, 'node_modules', 'pooled', 'index.ts');
const POOL = [...LISTED, PACKAGE];
const IMPORTER = path.join(POOL_DIR, 'importer.ts');

/** The side-effect import of nothing TypeScript diagnoses (`noUncheckedSideEffectImports`); the generator's steps, its seeded linear congruential choice (the C library's constants), a choice between two; the first of a list, the second, the third, and the step to the next. */
const NO_SIDE_EFFECT_MODULE = 2882;
const STEPS = 30;
const SEED = 58;
const MULTIPLIER = 1_103_515_245;
const INCREMENT = 12_345;
const MODULUS = 2_147_483_648;
const EITHER = 2;
const FIRST = 0;
const SECOND = 1;
const THIRD = 2;
const ONE = 1;

/**
 * Open a project over `files`, read it, close it.
 *
 * @param {readonly string[]} files - The project's files, by absolute path.
 * @param {(program: Readonly<Program>) => Result} read - What is read of its program.
 * @param {Readonly<Record<string, unknown>>} options - Its compiler options.
 * @returns {Result} What was read.
 */
function withProject<Result>(
  files: readonly string[],
  read: (program: Readonly<Program>) => Result,
  options: Readonly<Record<string, unknown>> = OPTIONS,
): Result {
  const config = path.join(BASE, 'projects', nextName(), 'tsconfig.json');
  const unmount = mount(new Map([[config, JSON.stringify({ compilerOptions: options, files })]]));
  try {
    const project = snapshot({ openProjects: [config] }).getProject(config);
    if (project === undefined) {
      throw new Error('the project did not open');
    }
    return read(project.program);
  } finally {
    snapshot({ closeProjects: [config] });
    unmount();
  }
}

/**
 * The text a new project reads at a path: its first line, or `absent`.
 *
 * @param {string} file - The path.
 * @returns {string} What it reads.
 */
function textAt(file: string): string {
  return withProject([file], (program) => program.getSourceFile(file)?.text.split('\n').at(FIRST) ?? 'absent');
}

/**
 * The pool's files a new project reads: each listed file it holds, and the package if its bare import resolves.
 *
 * @returns {readonly string[]} The served files, by path below the pool.
 */
function served(): readonly string[] {
  const listed = withProject(LISTED, (program) => LISTED.filter((file) => program.getSourceFile(file) !== undefined));
  const reached = withProject([IMPORTER], (program) => program.getSourceFileNames().filter((file) => file === PACKAGE));
  return [...listed, ...reached].map((file) => path.relative(POOL_DIR, file)).toSorted(byCodeUnit);
}

/**
 * What the live mounts hold, by path below the pool.
 *
 * @param {readonly Live[]} live - The live mounts.
 * @returns {readonly string[]} Their files, each once.
 */
function held(live: readonly Live[]): readonly string[] {
  return [...new Set(live.flatMap((mounted) => mounted.files))].map((file) => path.relative(POOL_DIR, file)).toSorted(byCodeUnit);
}

/** A seeded generator of interleaved, overlapping mounts and unmounts over the pool. */
class Mounts {
  private readonly live: Live[] = [];

  private seed = SEED;

  /**
   * One step: unmount a live mount, or mount some of the pool; then what a new project reads against
   * what the live mounts hold.
   *
   * @param {number} step - The step's number.
   * @returns {readonly unknown[]} The step, if they differ.
   */
  public step(step: number): readonly unknown[] {
    if (this.live.length > FIRST && this.next(EITHER) === FIRST) {
      this.live.splice(this.next(this.live.length), ONE).at(FIRST)?.unmount();
    } else {
      this.mountSome();
    }
    const [expected, actual] = [held(this.live), served()];
    return JSON.stringify(actual) === JSON.stringify(expected) ? [] : [{ actual, expected, step }];
  }

  /** Unmount every live mount. */
  public clear(): void {
    for (const mounted of this.live.splice(FIRST)) {
      mounted.unmount();
    }
  }

  /** Mount some of the pool, at least one file. */
  private mountSome(): void {
    const chosen = POOL.filter(() => this.next(EITHER) === FIRST);
    const files = chosen.length > FIRST ? chosen : POOL.slice(FIRST, ONE);
    const texts = new Map(files.map((file) => [file, 'export const v = 1;\n'] as const));
    this.live.push({ files, unmount: mount(texts) });
  }

  /**
   * The next seeded choice below `bound`.
   *
   * @param {number} bound - How many to choose from.
   * @returns {number} The choice.
   */
  private next(bound: number): number {
    this.seed = (this.seed * MULTIPLIER + INCREMENT) % MODULUS;
    return this.seed % bound;
  }
}

/**
 * What a new project reads at `file` after each of `actions`.
 *
 * @param {string} file - The path read.
 * @param {readonly (() => void)[]} actions - Mounts and unmounts, in order.
 * @returns {readonly string[]} Each read.
 */
function readsAfter(file: string, actions: readonly (() => void)[]): readonly string[] {
  return actions.map((action) => {
    action();
    return textAt(file);
  });
}

/**
 * Mounts and unmounts of one path, each a step of `readsAfter`: the unmount of the nth mount made.
 *
 * @param {string} file - The path.
 * @returns {Readonly<{ mountAs: (text: string) => () => void; unmountNth: (index: number) => () => void }>} The steps.
 */
function stepsOf(file: string): Readonly<{ mountAs: (text: string) => () => void; unmountNth: (index: number) => () => void }> {
  const made: (() => void)[] = [];
  return {
    mountAs: (text) => () => {
      made.push(mount(new Map([[file, text]])));
    },
    unmountNth: (index) => () => {
      made.at(index)?.();
    },
  };
}

describe('the session', () => {
  test('serves a path while some mount holds it, as the latest gives it, whichever unmounts first', ({ expect }) => {
    expect.hasAssertions();
    const file = path.join(BASE, 'overlap', 'x.ts');
    const { mountAs, unmountNth } = stepsOf(file);
    const actions = [
      mountAs('export const first = 1;'),
      mountAs('export const second = 2;'),
      unmountNth(SECOND),
      mountAs('export const third = 3;'),
      unmountNth(FIRST),
      unmountNth(THIRD),
    ];
    expect(readsAfter(file, actions)).toStrictEqual([
      'export const first = 1;',
      'export const second = 2;',
      'export const first = 1;',
      'export const third = 3;',
      'export const third = 3;',
      'absent',
    ]);
  });

  test('serves the files and directories of interleaved, overlapping mounts exactly while a live mount holds them', ({ expect }) => {
    expect.hasAssertions();
    const unmountImporter = mount(new Map([[IMPORTER, "import 'pooled';\nexport {};\n"]]));
    const mounts = new Mounts();
    try {
      expect(Array.from({ length: STEPS }, (_unused, step) => mounts.step(step)).flat()).toStrictEqual([]);
    } finally {
      mounts.clear();
      unmountImporter();
    }
  });
});

describe('the session after an unmount', () => {
  test('a path mounted again reads its new text, an unmount called twice doing nothing the second time', ({ expect }) => {
    expect.hasAssertions();
    const file = path.join(BASE, 'again', 'x.ts');
    const { mountAs, unmountNth } = stepsOf(file);
    const actions = [
      mountAs('export const first = 1;'),
      unmountNth(FIRST),
      unmountNth(FIRST),
      mountAs('export const second = 2;'),
      unmountNth(FIRST),
      unmountNth(SECOND),
    ];
    expect(readsAfter(file, actions)).toStrictEqual([
      'export const first = 1;',
      'absent',
      'absent',
      'export const second = 2;',
      'export const second = 2;',
      'absent',
    ]);
  });

  test('a real file read, overlaid, then released reads as on disk again', async ({ expect }) => {
    expect.hasAssertions();
    const real = path.join(REPO_ROOT, 'harness', 'lib', 'present.ts');
    const text = await readFile(real, 'utf8');
    const disk = text.split('\n').at(FIRST);
    const overlaid = overlaying(new Map([[real, 'export const overlay = 1;']]), () => textAt(real));
    expect([textAt(real), overlaid, textAt(real)]).toStrictEqual([disk, 'export const overlay = 1;', disk]);
  });
});

describe('the declaration rule', () => {
  test('declares a file TypeScript does not load itself inside declaring alone, nested or not, for no project opened before or after', ({
    expect,
  }) => {
    expect.hasAssertions();
    const sheet = path.join(BASE, 'declared', 'sheet.css');
    const user = path.join(BASE, 'declared', 'user.ts');
    const options = { ...OPTIONS, allowArbitraryExtensions: true, noUncheckedSideEffectImports: true };
    const unmount = mount(
      new Map([
        [sheet, 'a {}\n'],
        [user, "import './sheet.css';\nexport {};\n"],
      ]),
    );
    const codes = (): readonly number[] =>
      withProject(
        [user],
        (program) => program.getSemanticDiagnostics(user).map((diagnostic: Readonly<Diagnostic>) => diagnostic.code),
        options,
      );
    try {
      const nested = declaring(() => declaring(() => codes()));
      expect([codes(), declaring(() => codes()), nested, codes()]).toStrictEqual([
        [NO_SIDE_EFFECT_MODULE],
        [],
        [],
        [NO_SIDE_EFFECT_MODULE],
      ]);
    } finally {
      unmount();
    }
  });
});
