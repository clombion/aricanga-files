/**
 * The fence of the `exemption-lists` check: the literal lists a module consults undeclared, and the
 * declarations nothing consults, over `{path: source}` of harness modules.
 */

import type { Expression, SourceFile } from '#lib/ts-source.ts';
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
import { json, object } from '#lib/config.ts';
import { Accepted } from '#lib/exemptions.ts';
import { textOf } from '#lib/source-files.ts';

/** Declarations whose consult is a call that fails on a stale entry. */
const CONSULTED_BY_CALL = new Accepted(['Exemptions', 'CountedExemptions']);

const UNDECLARED = 'a literal collection consulted as a list: declare it';
const UNCONSULTED = 'a declaration nothing consults: delete it';

/** A list the fence refuses: its module, its name and why. */
interface Finding {
  readonly path: string;
  readonly name: string;
  readonly problem: string;
}

/**
 * The root `package.json` `imports` patterns, each with its target.
 *
 * @returns {readonly (readonly [string, string])[]} Each pattern and its target.
 */
function subpathPatterns(): readonly (readonly [string, string])[] {
  const manifest = object(json(textOf('package.json')), 'package.json');
  const imports = object(manifest['imports'] ?? {}, 'imports');
  return Object.entries(imports).flatMap(([pattern, target]: readonly [string, unknown]) => (typeof target === 'string' ? [[pattern, target] as const] : []));
}

/**
 * The repository path a subpath import names, through the root `package.json` `imports`.
 *
 * @param {string} specifier - A `#…` specifier.
 * @returns {string | undefined} The path it maps to, or `undefined` when no pattern maps it.
 */
function subpathTarget(specifier: string): string | undefined {
  for (const [pattern, target] of subpathPatterns()) {
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
 * @returns {(specifier: string) => boolean} A test of a specifier.
 */
function namesModule(path: string, target: string): (specifier: string) => boolean {
  return (specifier) => {
    if (specifier.startsWith('#')) {
      return subpathTarget(specifier) === target;
    }
    return specifier.startsWith('.') && normalize(join(dirname(path), specifier)) === target;
  };
}

/**
 * Whether a declaration is consulted in its module or in a module importing it.
 *
 * @param {string} name - The declaration's binding.
 * @param {string} kind - The declaration's class.
 * @param {readonly SourceFile[]} users - The declaring module and its importers.
 * @returns {boolean} Whether a user consults it.
 */
function isConsulted(name: string, kind: string, users: readonly SourceFile[]): boolean {
  return CONSULTED_BY_CALL.has(kind)
    ? users.some((user) => staleFailingReceivers(user).has(name))
    : users.some((user) => reads(user).has(name));
}

/**
 * The fence's findings in one module.
 *
 * @param {string} path - The module's path.
 * @param {ReadonlyMap<string, SourceFile>} files - Every parsed module, by path.
 * @returns {readonly Finding[]} The module's findings.
 */
function moduleFindings(path: string, files: ReadonlyMap<string, SourceFile>): readonly Finding[] {
  const file = files.get(path);
  if (file === undefined) {
    return [];
  }
  const listed = consultedNames(file, consultingParameters(file));
  const importers: readonly (readonly [string, SourceFile])[] = [...files].filter(([otherPath]: readonly [string, SourceFile]) => otherPath !== path);
  return [...moduleBindings(file)].flatMap(([name, value]: readonly [string, Expression]) => {
    const kind = declaration(value);
    if (kind === undefined) {
      return isLiteral(value) && listed.has(name) ? [{ name, path, problem: UNDECLARED }] : [];
    }
    const users = [file, ...importers.filter(([otherPath, other]) => importsFrom(other, namesModule(otherPath, path)).has(name)).map(([, other]) => other)];
    return isConsulted(name, kind, users) ? [] : [{ name, path, problem: UNCONSULTED }];
  });
}

/**
 * The fence's findings over `{path: source}` of harness modules.
 *
 * @param {Readonly<Record<string, string>>} modules - Each module's source, by path.
 * @returns {readonly Finding[]} Every module's findings.
 */
function findings(modules: Readonly<Record<string, string>>): readonly Finding[] {
  const files = new Map(Object.entries(modules).map(([path, text]: readonly [string, string]) => [path, parse(path, text)] as const));
  return [...files.keys()].flatMap((path) => moduleFindings(path, files));
}

export type { Finding };
export { findings, UNCONSULTED, UNDECLARED };
