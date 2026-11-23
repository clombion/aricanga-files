/** What the population's tests plant: scripted manifests, refusals as text, and git folders holding a workspace. */

import { mkdtemp, writeFile } from 'node:fs/promises';
import type { Population } from '#lib/scope.ts';
import { Scripted } from '#lib/scripted.ts';
import path from 'node:path';
import { run } from '#lib/process.ts';
import { tmpdir } from 'node:os';

/** How long one git command in a test folder may take, in milliseconds. */
const GIT_TIMEOUT_MS = 10_000;

/** The files a listing needs to pass the listing's floor. */
const FILLER = 50;

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
 * A git folder holding a workspace whose root manifest is `rootManifest`, over the listing's floor.
 *
 * @param {string} prefix - The folder's name prefix.
 * @param {string} rootManifest - The root `package.json`'s text.
 * @returns {Promise<string>} The folder.
 */
async function workspaceFolder(prefix: string, rootManifest: string): Promise<string> {
  const folder = await mkdtemp(path.join(tmpdir(), prefix));
  await writeFile(path.join(folder, 'package.json'), rootManifest);
  await writeFile(path.join(folder, 'pnpm-workspace.yaml'), "packages:\n  - 'a/*'\n");
  await Promise.all(
    Array.from({ length: FILLER }, async (_value, index) => {
      await writeFile(path.join(folder, `f${index}.txt`), '');
    }),
  );
  await run(['git', 'init', '-q'], { cwd: folder, timeoutMs: GIT_TIMEOUT_MS });
  return folder;
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

export { manifest, QUOTED_KEYS, reader, refusalOf, workspaceFolder };
