/**
 * What the `doc-references` check reads off disk, code and tools: the installed `node_modules/`
 * paths the spans ask about, the string values held code quotes, and the rule ids oxlint knows.
 */

import { REPO_ROOT, fromRoot } from '#lib/paths.ts';
import { list, object, parsed, stringOf } from '#lib/config.ts';
import { textsOf, tracked } from '#lib/source-files.ts';
import { HARNESS_CHECKS } from '#lib/test-globs.ts';
import type { Resolver } from './doc-references.resolve.ts';
import type { Span } from '#lib/docs.ts';
import { access } from 'node:fs/promises';
import { dirname } from 'node:path/posix';
import { finished } from '#lib/tools.ts';
import { heldFiles } from '#lib/scope.ts';
import { spanProblems } from './doc-references.resolve.ts';

const QUOTED = /['"](?<value>[^'"\n]+)['"]/gu;

/**
 * The listed manifests that carry a name, each name with its folder: the packages a reference may
 * name, the POC's included. Membership of the workspace is `harness/lib/scope.ts`'s question.
 *
 * @returns {Promise<readonly (readonly [string, string])[]>} Each package's name and folder.
 */
async function namedPackages(): Promise<readonly (readonly [string, string])[]> {
  const listed = await tracked();
  const texts = await textsOf(listed.filter((path) => path.endsWith('package.json') && !path.includes('node_modules/')));
  return texts.flatMap(([path, text]: readonly [string, string]) => {
    const { name } = object(parsed(text, path), path);
    return name === undefined ? [] : [[stringOf(name, `${path} name`), dirname(path)] as const];
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
  const known = await namedPackages();
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
 * @returns {Promise<ReadonlySet<string>>} The quoted values.
 */
async function quotedValues(): Promise<ReadonlySet<string>> {
  const found = new Set<string>();
  const files = await heldFiles('.ts', '.tsx', '.js', '.mjs', '.json');
  const texts = await textsOf(files.filter((held) => !held.startsWith(HARNESS_CHECKS)));
  for (const [, text] of texts) {
    for (const match of text.matchAll(QUOTED)) {
      found.add(match.groups?.['value'] ?? '');
    }
  }
  return found;
}

/**
 * The rule ids the locked oxlint knows, each a plugin and a rule joined by a slash (`node/no-process-env`), read from its own listing.
 *
 * @returns {Promise<ReadonlySet<string>>} The rule ids.
 */
async function oxlintRuleIds(): Promise<ReadonlySet<string>> {
  const done = await finished([fromRoot('node_modules', '.bin', 'oxlint'), '--rules', '--format=json'], { cwd: REPO_ROOT });
  const rules = list(parsed(done.stdout, "oxlint's rule listing"), "oxlint's rule listing");
  return new Set(
    rules.map((entry) => {
      const fields = object(entry, 'oxlint rule');
      return `${stringOf(fields['scope'], 'an oxlint rule scope').replaceAll('_', '-')}/${stringOf(fields['value'], 'an oxlint rule')}`;
    }),
  );
}

export { installedPaths, oxlintRuleIds, quotedValues };
