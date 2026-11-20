/**
 * What the `doc-references` check reads off disk and code: the installed `node_modules/` paths the
 * spans ask about, and the string values held code quotes.
 */

import { json, object } from '#lib/config.ts';
import { textOf, tracked } from '#lib/source-files.ts';
import { Prefixes } from '#lib/exemptions.ts';
import type { Resolver } from './doc-references.resolve.ts';
import type { Span } from '#lib/docs.ts';
import { access } from 'node:fs/promises';
import { dirname } from 'node:path/posix';
import { fromRoot } from '#lib/paths.ts';
import { heldFiles } from '#lib/scope.ts';
import { spanProblems } from './doc-references.resolve.ts';

const QUOTED = /['"](?<value>[^'"\n]+)['"]/gu;

/** The checks' own modules: their planted strings must never resolve a reference. */
const PLANTS = new Prefixes(['harness/checks/']);

/**
 * The listed workspace packages: their names and folders.
 *
 * @returns {readonly (readonly [string, string])[]} Each package's name and folder.
 */
function workspaces(): readonly (readonly [string, string])[] {
  return tracked()
    .filter((path) => path.endsWith('package.json') && !path.includes('node_modules/'))
    .flatMap((path) => {
      const { name } = object(json(textOf(path)), path);
      return typeof name === 'string' ? [[name, dirname(path)] as const] : [];
    });
}

/**
 * Whether a path exists under the repository root.
 *
 * @param {readonly string[]} parts - The path's parts.
 * @returns {Promise<boolean>} Whether it exists.
 */
async function exists(...parts: readonly string[]): Promise<boolean> {
  try {
    await access(fromRoot(...parts));
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether a `node_modules/` path is installed: at the root, or, for a package, under any workspace
 * package's own `node_modules` (pnpm links a dependency only where it is declared), or as a
 * workspace package itself.
 *
 * @param {string} path - A `node_modules/` path.
 * @returns {Promise<boolean>} Whether it is installed.
 */
async function installedOnDisk(path: string): Promise<boolean> {
  if (await exists(path)) {
    return true;
  }
  const inner = path.replace(/^node_modules\//u, '');
  const known = workspaces();
  if (known.some(([name]) => inner === name || inner.startsWith(`${name}/`))) {
    return true;
  }
  const found = await Promise.all(
    known.map(async ([, folder]) => {
      const present = await exists(folder, 'node_modules', inner);
      return present;
    }),
  );
  return found.includes(true);
}

/**
 * The installed paths among those the spans ask about, read from disk once.
 *
 * @param {readonly Span[]} spans - The spans to resolve.
 * @param {Omit<Resolver, 'installed'>} resolver - What else they resolve against.
 * @returns {Promise<ReadonlySet<string>>} The installed paths asked about.
 */
async function installedPaths(spans: readonly Span[], resolver: Omit<Resolver, 'installed'>): Promise<ReadonlySet<string>> {
  const asked = new Set<string>();
  const recording: Resolver = {
    ...resolver,
    installed: (path) => {
      asked.add(path);
      return false;
    },
  };
  for (const span of spans) {
    spanProblems(span, recording);
  }
  const paths = [...asked];
  const installed = await Promise.all(
    paths.map(async (path) => {
      const present = await installedOnDisk(path);
      return present;
    }),
  );
  return new Set(paths.filter((_path, index) => installed[index] === true));
}

/**
 * Every string value quoted in held TypeScript, JavaScript and JSON outside the checks.
 *
 * @returns {ReadonlySet<string>} The quoted values.
 */
function quotedValues(): ReadonlySet<string> {
  const found = new Set<string>();
  for (const path of heldFiles('.ts', '.tsx', '.js', '.mjs', '.json').filter((held) => !PLANTS.starts(held))) {
    for (const match of textOf(path).matchAll(QUOTED)) {
      found.add(match.groups?.['value'] ?? '');
    }
  }
  return found;
}

export { installedPaths, quotedValues };
