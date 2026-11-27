/**
 * The fence of the `exemption-lists` check: the literal lists a module consults undeclared, and the
 * declarations nothing consults, over `{path: source}` of harness modules. A declaration's consults
 * are found by the checker's symbol (a scan over the modules): every reference the checker resolves
 * to it counts, in its module or in any module importing it by any form (a named or namespace
 * import, a literal or destructured `import()`, a re-export then an import).
 */

import type { Expression, Node } from '#lib/ts-source.ts';
import {
  consultedNames,
  consultingParameters,
  declaration,
  destructuredBinding,
  isLiteral,
  isReadReference,
  isStaleFailingReference,
  moduleBindings,
} from './exemption-lists.consults.ts';
import { openScan, sourceOf } from '#lib/checker.ts';
import { KINDS } from '#lint-rules/exemptions.ts';
import type { Kind } from '#lint-rules/exemptions.ts';
import type { Scan } from '#lib/checker.ts';
import { isVariableDeclaration } from 'typescript/unstable/ast/is';
import { plantedPopulation } from '#lib/planted-population.ts';

const UNDECLARED = 'a literal collection consulted as a list: declare it';
const UNCONSULTED = 'a declaration nothing consults: delete it';

/** A list the fence refuses: its module, its name and why. */
interface Finding {
  readonly path: string;
  readonly name: string;
  readonly problem: string;
}

/**
 * The references the checker finds to a name, across the scan's modules.
 *
 * @param {Scan} scan - The open scan.
 * @param {Node} name - A name.
 * @returns {readonly Node[]} Its references, its own declaration included.
 */
function referencedBy(scan: Scan, name: Node): readonly Node[] {
  const found: Node[] = [];
  for (const entry of scan.checker.getReferencedSymbolsForNode(name, name.getStart(name.getSourceFile()))) {
    found.push(...entry.references.flatMap((handle) => handle.resolve() ?? []));
  }
  return found;
}

/**
 * Every reference the checker resolves to a binding, across the scan's modules, and through each
 * binding a destructuring of it introduces.
 *
 * @param {Scan} scan - The open scan.
 * @param {Node} name - The binding's name.
 * @returns {readonly Node[]} The references, the binding's own name included.
 */
function referencesTo(scan: Scan, name: Node): readonly Node[] {
  const found: Node[] = [];
  const pending = [name];
  const seen = new Set<Node>();
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (!seen.has(next)) {
      seen.add(next);
      const references = referencedBy(scan, next);
      found.push(...references);
      pending.push(...references.flatMap((reference) => destructuredBinding(reference) ?? []));
    }
  }
  return found;
}

/**
 * Whether a declaration is consulted, in its module or in a module importing it.
 *
 * @param {Scan} scan - The open scan.
 * @param {Expression} value - The declaration's initializer.
 * @param {Kind} kind - The declaration's kind.
 * @returns {boolean} Whether a reference consults it.
 */
function isConsulted(scan: Scan, value: Expression, kind: Kind): boolean {
  const { parent } = value;
  if (!isVariableDeclaration(parent)) {
    return false;
  }
  const references = referencesTo(scan, parent.name);
  return KINDS.of(kind) === 'call'
    ? references.some((reference) => isStaleFailingReference(reference))
    : references.some((reference) => isReadReference(reference));
}

/**
 * The fence's findings in one module.
 *
 * @param {Scan} scan - The open scan over the fenced modules.
 * @param {string} path - The module's path.
 * @returns {readonly Finding[]} The module's findings.
 */
function moduleFindings(scan: Scan, path: string): readonly Finding[] {
  const file = sourceOf(scan, path);
  const listed = consultedNames(file, consultingParameters(file));
  return [...moduleBindings(file)].flatMap(([name, value]: readonly [string, Expression]) => {
    const kind = declaration(value);
    if (kind === undefined) {
      return isLiteral(value) && listed.has(name) ? [{ name, path, problem: UNDECLARED }] : [];
    }
    return isConsulted(scan, value, kind) ? [] : [{ name, path, problem: UNCONSULTED }];
  });
}

/**
 * The fence's findings over `{path: source}` of harness modules, read through one scan of them.
 *
 * @param {Readonly<Record<string, string>>} modules - Each module's source, by path.
 * @returns {Promise<readonly Finding[]>} Every module's findings.
 */
async function findings(modules: Readonly<Record<string, string>>): Promise<readonly Finding[]> {
  const paths = Object.keys(modules);
  const scan = openScan(await plantedPopulation(paths, []), modules);
  try {
    return scan.serving(() => paths.flatMap((path) => moduleFindings(scan, path)));
  } finally {
    scan.close();
  }
}

export type { Finding };
export { findings, UNCONSULTED, UNDECLARED };
