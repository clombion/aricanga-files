/**
 * The virtual file system the TypeScript session reads (`ts-session.ts`): a mounted path need not exist
 * on disk, nor its directories (a directory holding a mounted path exists, so an import resolves into a
 * planted member wherever it sits), a mounted real path reads as its mounted text, and a path reached
 * through a symlinked directory (a workspace package under `node_modules`) reads as the real path it
 * names. Mounts may overlap: a path is served while some mount holds it, as the latest of them gives it.
 * A mount stands across turns, and every project opened while it stands reads it, any scan's, so a
 * mount of a path the disk holds is refused: such a path is overlaid by `overlaying` alone, for one
 * synchronous run, in which no other scan can open a project.
 * Every path whose answer may have changed is kept until the session tells TypeScript's server, which
 * caches what it read. While the declaration rule is on, each file TypeScript does not load itself (a
 * stylesheet, a file with no extension, mounted or on disk) is declared: the declaration it looks for
 * beside the file (x.d.css.ts beside x.css, x.d.ts beside x) reads as an empty module while no
 * such declaration exists, so the file is in a project's list like any module.
 */

import { declarationOf, declaredFile } from './declaration-paths.ts';
import { realpathSync, statSync } from 'node:fs';
import { isEmpty } from './lists.ts';
import nodePath from 'node:path';

/** One mount, one path more, or one rule turned on. */
const STEP = 1;

/** The count of a directory holding no served path, or of the rule turned on by nobody. */
const NONE = 0;

/** The latest of a path's layers. */
const LATEST = -1;

/** The text a declared file reads as: an empty module. */
const DECLARED = 'export {};\n';

/** One mount's text for a path. */
interface Layer {
  readonly mount: number;
  readonly text: string;
}

/**
 * What the disk holds at a path: a file, a directory with its real path, or nothing.
 *
 * @param {string} name - An absolute path.
 * @returns {Readonly<{ file: boolean; real: string }> | undefined} The entry, or none.
 */
function onDisk(name: string): Readonly<{ file: boolean; real: string }> | undefined {
  // oxlint-disable-next-line node/no-sync -- TypeScript's file system callbacks are synchronous: its server waits on each answer
  const entry = statSync(name, { throwIfNoEntry: false });
  // oxlint-disable-next-line node/no-sync -- TypeScript's file system callbacks are synchronous: its server waits on each answer
  return entry === undefined ? undefined : { file: entry.isFile(), real: entry.isFile() ? name : realpathSync(name) };
}

/**
 * The directories above a path, nearest first, the root excluded.
 *
 * @param {string} name - An absolute path.
 * @returns {readonly string[]} Its ancestor directories.
 */
function ancestors(name: string): readonly string[] {
  const found: string[] = [];
  for (let dir = nodePath.dirname(name); dir !== nodePath.dirname(dir); dir = nodePath.dirname(dir)) {
    found.push(dir);
  }
  return found;
}

/** What the session's TypeScript API reads, and the paths it must be told have changed. */
class VirtualFiles {
  /** Each served path's live mounts, in mount order: the last gives its text. */
  private readonly layers = new Map<string, readonly Layer[]>();

  /** Each directory above a served path, with how many served paths it holds: kept with `layers`. */
  private readonly mountedDirs = new Map<string, number>();

  /** Each directory's real path, read once a mount: a served path is found through a symlinked directory too. */
  private readonly realDirs = new Map<string, string>();

  /** The paths whose answer may have changed since they were last taken. */
  private readonly changed = new Set<string>();

  /** The declaration paths the rule would answer that TypeScript asked about: changed when the rule turns on or off. */
  private readonly asked = new Set<string>();

  private mounts = NONE;

  private declaring = NONE;

  /**
   * Serve `files` until the returned function is called. A path another live mount serves too reads as
   * the later mount's text while both stand, and as the other's once this one is unmounted. A path the
   * disk holds is refused: overlay it with `overlaying`.
   *
   * @param {Readonly<ReadonlyMap<string, string>>} files - Each file's text, by absolute path; none the disk holds.
   * @returns {() => void} Unmounts the files; a second call does nothing.
   */
  public mount(files: Readonly<ReadonlyMap<string, string>>): () => void {
    const real = [...files.keys()].find((name) => VirtualFiles.isOnDisk(name));
    if (real !== undefined) {
      throw new Error(
        `the session mounts no path the disk holds (${real}): every project opened while the mount stands would read it; overlay it with \`overlaying\``,
      );
    }
    return this.layer(files);
  }

  /**
   * Run `run` with `files` served, paths the disk holds included, and unmount them as it returns. The
   * run is synchronous, so no other scan opens a project while the overlay stands; a run that returns a
   * promise is refused, the overlay already gone.
   *
   * @param {Readonly<ReadonlyMap<string, string>>} files - Each file's text, by absolute path.
   * @param {() => Result} run - What reads the overlaid files.
   * @returns {Result} What `run` returns.
   */
  public overlaying<Result>(files: Readonly<ReadonlyMap<string, string>>, run: () => Result): Result {
    const unmount = this.layer(files);
    try {
      const result = run();
      if (result instanceof Promise) {
        throw new TypeError('an overlay is served for one synchronous run: a run that awaits would outlive it');
      }
      return result;
    } finally {
      unmount();
    }
  }

  /**
   * Run `run` with the declaration rule on.
   *
   * @param {() => Result} run - What reads the declared files.
   * @returns {Result} What `run` returns.
   */
  public declaringWhile<Result>(run: () => Result): Result {
    this.toggled();
    this.declaring += STEP;
    try {
      return run();
    } finally {
      this.declaring -= STEP;
      this.toggled();
    }
  }

  /**
   * Whether the disk holds a path: a file or a directory, through symlinks.
   *
   * @param {string} name - An absolute path.
   * @returns {boolean} Whether it does.
   */
  public static isOnDisk(name: string): boolean {
    return onDisk(name) !== undefined;
  }

  /**
   * The paths whose answer may have changed since the last call, forgotten once taken.
   *
   * @returns {readonly string[]} The paths.
   */
  public takeChanged(): readonly string[] {
    const taken = [...this.changed];
    this.changed.clear();
    return taken;
  }

  /** Forget the changes: a fresh session has read nothing. */
  public forgetChanged(): void {
    this.changed.clear();
  }

  /**
   * The text a path reads as: a live mount's, through its real path too, or a declaration the rule
   * answers; none for a path the disk answers.
   *
   * @param {string} name - An absolute path.
   * @returns {string | undefined} Its text, or none.
   */
  public served(name: string): string | undefined {
    const text = this.layers.get(name)?.at(LATEST)?.text ?? this.layers.get(this.real(name))?.at(LATEST)?.text;
    return text ?? (this.declares(name) ? DECLARED : undefined);
  }

  /**
   * Whether a directory holds a served path, by its spelling or its real path.
   *
   * @param {string} name - An absolute path.
   * @returns {boolean} Whether it does.
   */
  public holdsServed(name: string): boolean {
    return this.mountedDirs.has(name) || this.mountedDirs.has(this.real(name));
  }

  /**
   * A path with its directory resolved to its real path, through the nearest directory on disk.
   *
   * @param {string} name - An absolute path.
   * @returns {string} The path through the real directory.
   */
  public real(name: string): string {
    const dir = nodePath.dirname(name);
    if (dir === name) {
      return name;
    }
    const found = this.realDirs.get(dir) ?? onDisk(dir)?.real ?? this.real(dir);
    this.realDirs.set(dir, found);
    return nodePath.join(found, nodePath.basename(name));
  }

  /**
   * Add one mount's layer for each of `files`, until the returned function is called.
   *
   * @param {Readonly<ReadonlyMap<string, string>>} files - Each file's text, by absolute path.
   * @returns {() => void} Removes the layer; a second call does nothing.
   */
  private layer(files: Readonly<ReadonlyMap<string, string>>): () => void {
    this.mounts += STEP;
    const layer = this.mounts;
    this.realDirs.clear();
    for (const [name, text] of files) {
      this.restack(name, [...(this.layers.get(name) ?? []), { mount: layer, text }]);
    }
    return () => {
      this.realDirs.clear();
      for (const name of files.keys()) {
        this.restack(
          name,
          (this.layers.get(name) ?? []).filter((kept) => kept.mount !== layer),
        );
      }
    };
  }

  /**
   * Set a path's live mounts, counting it in or out of its directories and marking it changed.
   *
   * @param {string} name - The path.
   * @param {readonly Layer[]} layers - Its live mounts.
   */
  private restack(name: string, layers: readonly Layer[]): void {
    const served = this.layers.has(name);
    if (isEmpty(layers)) {
      this.layers.delete(name);
    } else {
      this.layers.set(name, layers);
    }
    if (served !== this.layers.has(name)) {
      this.count(name, served ? -STEP : STEP);
    }
    this.changed.add(name).add(declarationOf(name));
  }

  /**
   * Count a served path in or out of each directory above it.
   *
   * @param {string} name - The path.
   * @param {number} step - One in, or one out.
   */
  private count(name: string, step: number): void {
    for (const dir of ancestors(name)) {
      const left = (this.mountedDirs.get(dir) ?? NONE) + step;
      if (left === NONE) {
        this.mountedDirs.delete(dir);
      } else {
        this.mountedDirs.set(dir, left);
      }
    }
  }

  /** Mark every declaration asked of the rule as changed as the rule turns on or off, forgetting it until asked again. */
  private toggled(): void {
    if (this.declaring === NONE) {
      for (const name of this.asked) {
        this.changed.add(name);
      }
      this.asked.clear();
    }
  }

  /**
   * Whether the rule declares `name`: the declaration of a file a mount or the disk serves, while none
   * is mounted or on disk. Asked with the rule off, it is remembered and answers no.
   *
   * @param {string} name - An absolute path.
   * @returns {boolean} Whether the rule declares it now.
   */
  private declares(name: string): boolean {
    const file = declaredFile(name);
    if (
      file === undefined ||
      onDisk(name)?.file === true ||
      !(this.layers.has(file) || this.layers.has(this.real(file)) || onDisk(file)?.file === true)
    ) {
      return false;
    }
    this.asked.add(name);
    return this.declaring !== NONE;
  }
}

export { VirtualFiles };
