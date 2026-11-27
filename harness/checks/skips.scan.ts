/**
 * The scan of the `skips` check: every skip of one test module, as `site(path, owner)`, where the
 * owner is the title of the test the skip belongs to, or `<module>`.
 */

import { Accepted, site } from '#lint-rules/exemptions.ts';
import type { CallExpression, Expression, Node, SourceFile } from 'typescript/unstable/ast';
import { chain, importsFrom, nodes, parse } from '#lib/ts-source.ts';
import {
  isArrowFunction,
  isCallExpression,
  isFunctionExpression,
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isObjectBindingPattern,
  isPropertyAccessExpression,
  isSourceFile,
  isStringLiteral,
} from 'typescript/unstable/ast/is';

/** The test functions of the runners, by the name they are exported under. */
const RUNNER_FUNCTIONS = new Accepted(['test', 'it', 'describe', 'suite', 'bench']);
const RUNNERS = new Accepted(['vitest', '@playwright/test']);
const SKIPPING = new Accepted(['skip', 'skipIf', 'runIf', 'todo', 'only', 'fails', 'fixme', 'fail']);

/** The names a test callback binds its context to, and its destructured `skip` to. */
interface ContextNames {
  readonly context: ReadonlySet<string>;
  readonly skip: ReadonlySet<string>;
}

/**
 * The local names that stand for a runner's test functions in one module.
 *
 * @param {SourceFile} file - The parsed module.
 * @returns {ReadonlySet<string>} The local names.
 */
function runnerNames(file: SourceFile): ReadonlySet<string> {
  const names = new Set<string>();
  for (const runner of RUNNERS) {
    for (const [local, imported] of importsFrom(file, runner)) {
      if (RUNNER_FUNCTIONS.has(imported)) {
        names.add(local);
      }
    }
  }
  return names;
}

/**
 * The title a test call names, if its first argument is a literal.
 *
 * @param {CallExpression} call - A test call.
 * @returns {string | undefined} The title.
 */
function titleOf(call: CallExpression): string | undefined {
  const [first] = call.arguments;
  return first !== undefined && (isStringLiteral(first) || isNoSubstitutionTemplateLiteral(first)) ? first.text : undefined;
}

/**
 * The first name of an expression's call or access chain: `test` in `test.skip(…)('a')`.
 *
 * @param {Expression} expression - A callee.
 * @returns {string | undefined} The chain's first name.
 */
function rootOf(expression: Expression): string | undefined {
  if (isCallExpression(expression)) {
    return rootOf(expression.expression);
  }
  const [root] = chain(expression) ?? [];
  return root;
}

/**
 * Whether a node calls one of the module's test functions.
 *
 * @param {Node} node - Any node.
 * @param {ReadonlySet<string>} names - The test functions' local names.
 * @returns {boolean} Whether it is a test call.
 */
function isTestCall(node: Node, names: ReadonlySet<string>): node is CallExpression {
  return isCallExpression(node) && names.has(rootOf(node.expression) ?? '');
}

/**
 * The title of the innermost titled test call holding a node, or `<module>`.
 *
 * @param {Node} node - Any node.
 * @param {ReadonlySet<string>} names - The test functions' local names.
 * @returns {string} The owner.
 */
function ownerOf(node: Node, names: ReadonlySet<string>): string {
  let current: Node = node;
  while (!isSourceFile(current)) {
    const title = isTestCall(current, names) ? titleOf(current) : undefined;
    if (title !== undefined) {
      return title;
    }
    current = current.parent;
  }
  return '<module>';
}

/**
 * The names a callback's first parameter destructures `skip` into.
 *
 * @param {Node} parameter - The parameter's binding.
 * @returns {readonly string[]} The bound names.
 */
function destructuredSkips(parameter: Node): readonly string[] {
  if (!isObjectBindingPattern(parameter)) {
    return [];
  }
  const bound: string[] = [];
  for (const element of parameter.elements) {
    const { name } = element;
    const key = element.propertyName ?? name;
    if (key !== undefined && isIdentifier(key) && key.text === 'skip' && name !== undefined && isIdentifier(name)) {
      bound.push(name.text);
    }
  }
  return bound;
}

/**
 * The test context parameters of a test call's callbacks: their first parameter, or `skip` destructured from it.
 *
 * @param {CallExpression} call - A test call.
 * @returns {ContextNames} The context names and the bound `skip` names.
 */
function contextSkips(call: CallExpression): ContextNames {
  const context = new Set<string>();
  const skip = new Set<string>();
  for (const argument of call.arguments) {
    const [first] = isArrowFunction(argument) || isFunctionExpression(argument) ? argument.parameters : [];
    if (first !== undefined && isIdentifier(first.name)) {
      context.add(first.name.text);
    }
    for (const name of first === undefined ? [] : destructuredSkips(first.name)) {
      skip.add(name);
    }
  }
  return { context, skip };
}

/**
 * Whether a call inside a test skips it through its context: `context.skip()` or a bound `skip()`.
 *
 * @param {Node} inner - A node inside the test call.
 * @param {ContextNames} names - The test's context names.
 * @returns {boolean} Whether the call skips.
 */
function skipsThroughContext(inner: Node, names: ContextNames): boolean {
  if (!isCallExpression(inner)) {
    return false;
  }
  const [first = '', second, third] = chain(inner.expression) ?? [];
  const viaContext = names.context.has(first) && second === 'skip' && third === undefined;
  const viaBinding = names.skip.has(first) && second === undefined;
  return viaContext || viaBinding;
}

/**
 * The owner of a skip modifier (`test.skip`, `describe.only` …), if the node is one.
 *
 * @param {Node} node - Any node.
 * @param {ReadonlySet<string>} names - The test functions' local names.
 * @returns {readonly string[]} The skip's owner, or nothing.
 */
function modifierSkips(node: Node, names: ReadonlySet<string>): readonly string[] {
  if (!isPropertyAccessExpression(node) || !SKIPPING.has(node.name.text)) {
    return [];
  }
  const [root = ''] = chain(node) ?? [];
  return names.has(root) ? [ownerOf(node, names)] : [];
}

/**
 * The owner of a test that skips itself through its context, if the node is such a test.
 *
 * @param {Node} node - Any node.
 * @param {ReadonlySet<string>} names - The test functions' local names.
 * @returns {readonly string[]} The test's owner, or nothing.
 */
function contextOwners(node: Node, names: ReadonlySet<string>): readonly string[] {
  if (!isTestCall(node, names)) {
    return [];
  }
  const context = contextSkips(node);
  const skipped = nodes(node).some((inner) => inner !== node && skipsThroughContext(inner, context));
  return skipped ? [titleOf(node) ?? ownerOf(node, names)] : [];
}

/**
 * The skip sites of one test module, as `site(path, owner)`.
 *
 * @param {string} path - The module's path.
 * @param {string} text - The module's text.
 * @returns {readonly string[]} The sites, sorted.
 */
function skips(path: string, text: string): readonly string[] {
  const file = parse(path, text);
  const names = runnerNames(file);
  const all = nodes(file);
  const owners = [...all.flatMap((node) => modifierSkips(node, names)), ...all.flatMap((node) => contextOwners(node, names))];
  return [...new Set(owners.map((owner) => site(path, owner)))].toSorted();
}

export { skips };
