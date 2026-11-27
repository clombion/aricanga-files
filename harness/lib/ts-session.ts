/**
 * The process's one TypeScript 7 API session, over the virtual file system of `virtual-files.ts`:
 * mounted paths, overlapping mounts, real paths through symlinked directories, and, while `declaring`
 * runs, the declaration rule. TypeScript's server caches what the file system answered, so every
 * snapshot is taken through `snapshot`, which tells it each path whose answer may have changed since
 * the last one. The session's child
 * process is released without this module: it ends when its standard input closes, which every ending
 * of this process does (an exit, a signal, a worker its pool kills). The TypeScript API's own `exit`
 * listener sends the child SIGTERM, which the child outlives by seconds; a release after it would ask a
 * child that is going away to release its snapshots, so this module adds no exit hook. The
 * `suppressions` check characterises the release against the pinned TypeScript: once a process
 * that opened a session exits, its child is gone.
 */

import { API } from 'typescript/unstable/sync';
import { REPO_ROOT } from './paths.ts';
import type { Snapshot } from 'typescript/unstable/sync';
import { VirtualFiles } from './virtual-files.ts';
import { isEmpty } from './lists.ts';

/** The projects and files a snapshot opens or closes, by absolute path; `snapshot` adds the file changes itself. */
type SnapshotRequest = Readonly<{
  closeFiles?: readonly string[];
  closeProjects?: readonly string[];
  openFiles?: readonly string[];
  openProjects?: readonly string[];
}>;

/** The step from one issued name to the next. */
const NEXT = 1;

/** The count before any name is issued. */
const NONE_ISSUED = 0;

/** The session, opened on first use and forgotten when closed. */
class Session {
  public readonly files = new VirtualFiles();

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
   * A snapshot of the session, telling TypeScript's server each path whose answer may have changed.
   *
   * @param {SnapshotRequest} request - The projects and files to open or close.
   * @returns {Snapshot} The snapshot.
   */
  public snapshot(request: SnapshotRequest): Snapshot {
    const changed = this.files.takeChanged();
    const asked = {
      closeFiles: [...(request.closeFiles ?? [])],
      closeProjects: [...(request.closeProjects ?? [])],
      openFiles: [...(request.openFiles ?? [])],
      openProjects: [...(request.openProjects ?? [])],
    };
    return this.api().updateSnapshot(isEmpty(changed) ? asked : { ...asked, fileChanges: { changed: [...changed] } });
  }

  /**
   * Close the open session, if there is one. Idempotent: the session is forgotten before it is closed,
   * so a second call finds nothing to close, and a later snapshot starts a fresh session instead of
   * asking a closed one.
   */
  public close(): void {
    const closing = this.open;
    this.open = [];
    this.files.forgetChanged();
    for (const session of closing) {
      session.close();
    }
  }

  /**
   * The session, opened on first use.
   *
   * @returns {API} The open session.
   */
  private api(): API {
    const [current] = this.open;
    if (current !== undefined) {
      return current;
    }
    const { files } = this;
    const opened = new API({
      cwd: REPO_ROOT,
      fs: {
        directoryExists: (directoryName: string): boolean | undefined => (files.holdsServed(directoryName) ? true : undefined),
        fileExists: (fileName: string): boolean | undefined => (files.served(fileName) === undefined ? undefined : true),
        readFile: (fileName: string): string | undefined => files.served(fileName),
        realpath: (fileName: string): string | undefined => (files.served(fileName) === undefined ? undefined : files.real(fileName)),
      },
    });
    this.open = [opened];
    return opened;
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
  return SESSION.files.mount(files);
}

/**
 * Run `run` with the session declaring, by rule, each file TypeScript does not load itself.
 *
 * @param {() => Result} run - What reads the declared files.
 * @returns {Result} What `run` returns.
 */
function declaring<Result>(run: () => Result): Result {
  return SESSION.files.declaringWhile(run);
}

/**
 * A snapshot of the process's one TypeScript API session, telling its server each path whose answer
 * changed; type-aware scans open and close their projects through it.
 *
 * @param {SnapshotRequest} request - The projects and files to open or close.
 * @returns {Snapshot} The snapshot.
 */
function snapshot(request: SnapshotRequest): Snapshot {
  return SESSION.snapshot(request);
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

export { closeSession, declaring, mount, nextName, snapshot };
