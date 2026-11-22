/**
 * The process's one TypeScript 7 API session, and the virtual file system it reads: a mounted path
 * need not exist on disk, and a mounted real path reads as its mounted text.
 */

import { API } from 'typescript/unstable/sync';
import { REPO_ROOT } from './paths.ts';

/** The step from one issued name to the next. */
const NEXT = 1;

/** The count before any name is issued. */
const NONE_ISSUED = 0;

/** The session, opened on first use and forgotten when closed. */
class Session {
  private readonly virtual = new Map<string, string>();

  private open: readonly API[] = [];

  private issued = NONE_ISSUED;

  /**
   * A name no earlier call of this process gave: the next of a count.
   *
   * @returns {string} The name.
   */
  public nextName(): string {
    this.issued += NEXT;
    return String(this.issued);
  }

  /**
   * Serve `files` through the virtual file system until the returned function is called.
   *
   * @param {Readonly<ReadonlyMap<string, string>>} files - Each file's text, by absolute path.
   * @returns {() => void} Unmounts the files.
   */
  public mount(files: Readonly<ReadonlyMap<string, string>>): () => void {
    for (const [name, text] of files) {
      this.virtual.set(name, text);
    }
    return () => {
      for (const name of files.keys()) {
        this.virtual.delete(name);
      }
    };
  }

  /**
   * The session, opened on first use.
   *
   * @returns {API} The open session.
   */
  public api(): API {
    const [current] = this.open;
    if (current !== undefined) {
      return current;
    }
    const opened = new API({
      cwd: REPO_ROOT,
      fs: {
        fileExists: (fileName: string): boolean | undefined => (this.virtual.has(fileName) ? true : undefined),
        readFile: (fileName: string): string | undefined => this.virtual.get(fileName),
      },
    });
    this.open = [opened];
    process.once('exit', this.close.bind(this));
    return opened;
  }

  /**
   * Close the open session, if there is one. Idempotent: the session is forgotten before it is closed,
   * so a second call (or the exit hook after an explicit close) finds nothing to close, and a later
   * `api()` starts a fresh session instead of handing out a closed one.
   */
  public close(): void {
    const closing = this.open;
    this.open = [];
    for (const session of closing) {
      session.close();
    }
  }
}

const SESSION = new Session();

/**
 * Serve `files` through the session's virtual file system until the returned function is called.
 *
 * @param {Readonly<ReadonlyMap<string, string>>} files - Each file's text, by absolute path.
 * @returns {() => void} Unmounts the files.
 */
function mount(files: Readonly<ReadonlyMap<string, string>>): () => void {
  return SESSION.mount(files);
}

/**
 * The process's one TypeScript API session; type-aware scans open their projects on it.
 *
 * @returns {API} The open session.
 */
function api(): API {
  return SESSION.api();
}

/**
 * A name for a virtual file or project no earlier one of this process has.
 *
 * @returns {string} The name.
 */
function nextName(): string {
  return SESSION.nextName();
}

/** Close the open session, if there is one; idempotent. */
function closeSession(): void {
  SESSION.close();
}

export { api, closeSession, mount, nextName };
