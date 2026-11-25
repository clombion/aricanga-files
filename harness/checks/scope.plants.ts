/** What the population's tests plant: scripted manifests, refusals as text, and git folders holding a workspace. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Dir } from '#lib/package-dirs.ts';
import type { Population } from '#lib/scope.ts';
import { Scripted } from '#lib/scripted.ts';
import type { WorkspacePackage } from '#lib/workspace.ts';
import path from 'node:path';
import { run } from '#lib/process.ts';
import { tmpdir } from 'node:os';

/** How long one git command in a test folder may take, in milliseconds. */
const GIT_TIMEOUT_MS = 10_000;

/** The files a listing needs to pass the listing's floor. */
const FILLER = 50;

/** A byte-order mark: pnpm reads a manifest that starts with one, and `JSON.parse` refuses it. */
const BOM = '\uFEFF';

/** A reader of listed files that answers only the files its test scripted. */
class Files extends Scripted<string> {}

/**
 * A reader of the given texts that trips on any other path.
 *
 * @param {Readonly<Record<string, string>>} texts - Each file's text, by path.
 * @returns {(listed: string) => Promise<string>} The reader.
 */
function reader(texts: Readonly<Record<string, string>>): (listed: string) => Promise<string> {
  const files = new Files(texts);
  return async (listed: string): Promise<string> => {
    const text = await Promise.resolve(files.answer(listed));
    return text;
  };
}

/**
 * A reader of planted texts for which one listed file is gone from disk, as a git index can list a
 * deleted file.
 *
 * @param {string} gone - The file that cannot be read.
 * @param {Readonly<Record<string, string>>} texts - The other files' texts.
 * @returns {(listed: string) => Promise<string>} The reader.
 */
function withoutFile(gone: string, texts: Readonly<Record<string, string>>): (listed: string) => Promise<string> {
  const read = reader(texts);
  return async (listed: string): Promise<string> => {
    if (listed === gone) {
      throw new Error(`ENOENT: no such file or directory, open '${gone}'`);
    }
    const text = await read(listed);
    return text;
  };
}

/**
 * The refusal a population's computation ends in, as text.
 *
 * @param {Promise<Population>} computing - The computation.
 * @returns {Promise<string>} The refusal's text.
 */
async function refusalOf(computing: Promise<Population>): Promise<string> {
  try {
    await computing;
  } catch (error: unknown) {
    return String(error);
  }
  throw new Error('the population was not refused');
}

/** The colon-separated parts of a refusal's head: its class, its subject, and its own word on the error (a parser's detail, which varies with the engine, after it). */
const REFUSAL_HEAD = 3;

/**
 * A refusal's head, its engine detail dropped.
 *
 * @param {string} text - The refusal, as `String` renders it.
 * @returns {string} Its first parts.
 */
function headOf(text: string): string {
  return text.split(':', REFUSAL_HEAD).join(':');
}

/**
 * The refusal of a computation and the refusals its cause gathers, as text.
 *
 * @param {Promise<Population>} computing - The computation.
 * @returns {Promise<readonly [string, readonly string[]]>} The refusal, each cause it names in its message cut to its head, and each of its cause's.
 */
async function causedRefusal(computing: Promise<Population>): Promise<readonly [string, readonly string[]]> {
  try {
    await computing;
  } catch (error: unknown) {
    const causes = error instanceof Error && error.cause instanceof AggregateError ? error.cause.errors.map(String) : [];
    let refusal = String(error);
    for (const cause of causes) {
      refusal = refusal.replace(cause, headOf(cause));
    }
    return [refusal, causes];
  }
  return ['not refused', []];
}

/**
 * The listing pnpm gives of some packages: each directory, with the name pnpm reads from its manifest
 * (none where it declares none).
 *
 * @param {readonly (readonly [Dir, string?])[]} packages - Each package's directory and name.
 * @returns {readonly WorkspacePackage[]} The listing.
 */
function listing(...packages: readonly (readonly [Dir, string?])[]): readonly WorkspacePackage[] {
  return packages.map(([dir, name]) => ({ dir, name }));
}

/**
 * A manifest's text declaring a role.
 *
 * @param {string} role - The role word.
 * @returns {string} The manifest's text.
 */
function manifest(role: string): string {
  return JSON.stringify({ aricanga: { role }, name: 'x' });
}

/**
 * A git folder holding a workspace whose root manifest is `rootManifest`, over the listing's floor,
 * handed to `use` and removed once `use` settles.
 *
 * @param {string} prefix - The folder's name prefix.
 * @param {string} rootManifest - The root `package.json`'s text.
 * @param {(folder: string) => Promise<Value>} use - What the test does in the folder.
 * @returns {Promise<Value>} What `use` answers.
 */
async function inWorkspaceFolder<Value>(prefix: string, rootManifest: string, use: (folder: string) => Promise<Value>): Promise<Value> {
  const folder = await mkdtemp(path.join(tmpdir(), prefix));
  try {
    await writeFile(path.join(folder, 'package.json'), rootManifest);
    await writeFile(path.join(folder, 'pnpm-workspace.yaml'), "packages:\n  - 'a/*'\n");
    await Promise.all(
      Array.from({ length: FILLER }, async (_value, index) => {
        await writeFile(path.join(folder, `f${index}.txt`), '');
      }),
    );
    await run(['git', 'init', '-q'], { cwd: folder, timeoutMs: GIT_TIMEOUT_MS });
    return await use(folder);
  } finally {
    await rm(folder, { force: true, recursive: true });
  }
}

/** The importers block pnpm 10.28.0 writes for workspaces whose directories need YAML quoting. */
const QUOTED_KEYS: string = [
  "lockfileVersion: '9.0'",
  '',
  'importers:',
  '',
  '  .: {}',
  '',
  "  '@s/p':",
  '    devDependencies:',
  '      dep:',
  '        specifier: workspace:*',
  '        version: link:../../a/dep',
  '',
  '  a/#hash: {}',
  '',
  "  a/q'uote: {}",
  '',
  '  a/sp ace: {}',
  '',
  '  a/x:y:',
  '    devDependencies:',
  '      p5:',
  '        specifier: workspace:*',
  '        version: link:../plain',
  '',
  'packages:',
  '',
].join('\n');

/** A lockfile pnpm 10.28.0 writes: the root locks three tools, one with a peer, and a member, packages/app, locks one. */
const LOCK = `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      oxlint:
        specifier: 1.94.0
        version: 1.94.0
      planted:
        specifier: ^1.0.0
        version: 1.0.3(peer@2.0.0)
      '@scope/tool':
        specifier: ^2.0.0
        version: 2.1.0

  packages/app:
    devDependencies:
      vite:
        specifier: ^8.0.0
        version: 8.3.8

packages:

  oxlint@1.94.0:
    resolution: {integrity: sha512-x}
`;

export { BOM, causedRefusal, headOf, inWorkspaceFolder, listing, LOCK, manifest, QUOTED_KEYS, reader, refusalOf, withoutFile };
