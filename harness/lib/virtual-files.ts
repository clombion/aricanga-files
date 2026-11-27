/**
 * The virtual file system the TypeScript session reads (`ts-session.ts`): a mounted path need not exist
 * on disk, nor its directories (a directory holding a mounted path exists, so an import resolves into a
 * planted member wherever it sits), and a mounted real path reads as its mounted text. Mounts may
 * overlap: a path is served while some mount holds it, as the latest of them gives it. Every path whose
 * answer may have changed is kept until the session tells TypeScript's server, which caches what it read.
 */

import { isEmpty } from './lists.ts';
import nodePath from 'node:path';

/** One mount, one path more, or one rule turned on. */
const STEP = 1;

/** The count of a directory holding no served path, or of the rule turned on by nobody. */
const NONE = 0;

/** The latest of a path's layers. */
const LATEST = -1;

/** One mount's text for a path. */
interface Layer {
  readonly mount: number;
  readonly text: string;
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

  /** The paths whose answer may have changed since they were last taken. */
  private readonly changed = new Set<string>();

  private mounts = NONE;

  /**
   * Serve `files` until the returned function is called. A path another live mount serves too reads as
   * the later mount's text while both stand, and as the other's once this one is unmounted.
   *
   * @param {Readonly<ReadonlyMap<string, string>>} files - Each file's text, by absolute path.
   * @returns {() => void} Unmounts the files; a second call does nothing.
   */
  public mount(files: Readonly<ReadonlyMap<string, string>>): () => void {
    this.mounts += STEP;
    const layer = this.mounts;
    for (const [name, text] of files) {
      this.restack(name, [...(this.layers.get(name) ?? []), { mount: layer, text }]);
    }
    return () => {
      for (const name of files.keys()) {
        this.restack(
          name,
          (this.layers.get(name) ?? []).filter((kept) => kept.mount !== layer),
        );
      }
    };
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
   * The text a path reads as: a live mount's; none for a path the disk answers.
   *
   * @param {string} name - An absolute path.
   * @returns {string | undefined} Its text, or none.
   */
  public served(name: string): string | undefined {
    return this.layers.get(name)?.at(LATEST)?.text;
  }

  /**
   * Whether a directory holds a served path.
   *
   * @param {string} name - An absolute path.
   * @returns {boolean} Whether it does.
   */
  public holdsServed(name: string): boolean {
    return this.mountedDirs.has(name);
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
    this.changed.add(name);
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
}

export { VirtualFiles };
