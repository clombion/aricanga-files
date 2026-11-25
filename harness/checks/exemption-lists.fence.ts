/**
 * The fence of the `exemption-lists` check: the literal lists a module consults undeclared, and the
 * declarations nothing consults, over `{path: source}` of harness modules.
 */

import type { Expression, SourceFile } from '#lib/ts-source.ts';
import { absentAs, object } from '#lib/config.ts';
import {
  consultedNames,
  consultingParameters,
  declaration,
  isLiteral,
  moduleBindings,
  reads,
  staleFailingReceivers,
} from './exemption-lists.consults.ts';
import { dirname, join, normalize } from 'node:path/posix';
import { importsFrom, parse } from '#lib/ts-source.ts';
import { KINDS } from '#lib/exemptions.ts';
import type { Kind } from '#lib/exemptions.ts';
import { population } from '#lib/scope.ts';

const UNDECLARED = 'a literal collection consulted as a list: declare it';
const UNCONSULTED = 'a declaration nothing consults: delete it';

/** A list the fence refuses: its module, its name and why. */
interface Finding {
  readonly path: string;
  readonly name: string;
  readonly problem: string;
}

/**
 * The root `package.json` `imports` patterns, each with its target, as the population read the manifest.
 *
 * @returns {Promise<readonly (readonly [string, string])[]>} Each pattern and its target.
 */
async function subpathPatterns(): Promise<readonly (readonly [string, string])[]> {
  const held = await population();
  const imports = object(absentAs(held.rootManifest['imports'], {}), 'imports');
  return Object.entries(imports).flatMap(([pattern, target]: readonly [string, unknown]) =>
    typeof target === 'string' ? [[pattern, target] as const] : [],
  );
}

/**
 * The repository path a subpath import names, through the root `package.json` `imports`.
 *
 * @param {string} specifier - A `#…` specifier.
 * @param {readonly (readonly [string, string])[]} patterns - The `imports` patterns, each with its target.
 * @returns {string | undefined} The path it maps to, or `undefined` when no pattern maps it.
 */
function subpathTarget(specifier: string, patterns: readonly (readonly [string, string])[]): string | undefined {
  for (const [pattern, target] of patterns) {
    const prefix = pattern.replace(/\*$/u, '');
    if (pattern.endsWith('*') && specifier.startsWith(prefix)) {
      return normalize(target.replace(/\*$/u, specifier.slice(prefix.length)));
    }
  }
  return undefined;
}

/**
 * Whether a module at `path` names the module at `target` with a specifier.
 *
 * @param {string} path - The importing module.
 * @param {string} target - The imported module.
 * @param {readonly (readonly [string, string])[]} patterns - The `imports` patterns, each with its target.
 * @returns {(specifier: string) => boolean} A test of a specifier.
 */
function namesModule(path: string, target: string, patterns: readonly (readonly [string, string])[]): (specifier: string) => boolean {
  return (specifier) => {
    if (specifier.startsWith('#')) {
      return subpathTarget(specifier, patterns) === target;
    }
    return specifier.startsWith('.') && normalize(join(dirname(path), specifier)) === target;
  };
}

/**
 * Whether a declaration is consulted in its module or in a module importing it.
 *
 * @param {string} name - The declaration's binding.
 * @param {Kind} kind - The declaration's kind.
 * @param {readonly SourceFile[]} users - The declaring module and its importers.
 * @returns {boolean} Whether a user consults it.
 */
function isConsulted(name: string, kind: Kind, users: readonly SourceFile[]): boolean {
  return KINDS.of(kind) === 'call'
    ? users.some((user) => staleFailingReceivers(user).has(name))
    : users.some((user) => reads(user).has(name));
}

/**
 * The fence's findings in one module.
 *
 * @param {string} path - The module's path.
 * @param {ReadonlyMap<string, SourceFile>} files - Every parsed module, by path.
 * @param {readonly (readonly [string, string])[]} patterns - The root `imports` patterns, each with its target.
 * @returns {readonly Finding[]} The module's findings.
 */
function moduleFindings(
  path: string,
  files: ReadonlyMap<string, SourceFile>,
  patterns: readonly (readonly [string, string])[],
): readonly Finding[] {
  const file = files.get(path);
  if (file === undefined) {
    return [];
  }
  const listed = consultedNames(file, consultingParameters(file));
  const importers: readonly (readonly [string, SourceFile])[] = [...files].filter(
    ([otherPath]: readonly [string, SourceFile]) => otherPath !== path,
  );
  return [...moduleBindings(file)].flatMap(([name, value]: readonly [string, Expression]) => {
    const kind = declaration(value);
    if (kind === undefined) {
      return isLiteral(value) && listed.has(name) ? [{ name, path, problem: UNDECLARED }] : [];
    }
    const users = [
      file,
      ...importers
        .filter(([otherPath, other]) => importsFrom(other, namesModule(otherPath, path, patterns)).has(name))
        .map(([, other]) => other),
    ];
    return isConsulted(name, kind, users) ? [] : [{ name, path, problem: UNCONSULTED }];
  });
}

/**
 * The fence's findings over `{path: source}` of harness modules.
 *
 * @param {Readonly<Record<string, string>>} modules - Each module's source, by path.
 * @returns {Promise<readonly Finding[]>} Every module's findings.
 */
async function findings(modules: Readonly<Record<string, string>>): Promise<readonly Finding[]> {
  const patterns = await subpathPatterns();
  const files = new Map(Object.entries(modules).map(([path, text]: readonly [string, string]) => [path, parse(path, text)] as const));
  return [...files.keys()].flatMap((path) => moduleFindings(path, files, patterns));
}

export type { Finding };
export { findings, UNCONSULTED, UNDECLARED };
