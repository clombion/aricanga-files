/**
 * What a harness module declares and consults, read off its syntax tree for the `exemption-lists` fence.
 */

import { Accepted, KINDS } from '#lint-rules/exemptions.ts';
import type { Expression, Node, SourceFile } from '#lib/ts-source.ts';
import {
  isArrayLiteralExpression,
  isAsExpression,
  isBinaryExpression,
  isCallExpression,
  isElementAccessExpression,
  isFunctionDeclaration,
  isIdentifier,
  isImportSpecifier,
  isNewExpression,
  isNumericLiteral,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isVariableDeclaration,
  isVariableStatement,
} from 'typescript/unstable/ast/is';
import type { CallExpression } from 'typescript/unstable/ast';
import type { Kind } from '#lint-rules/exemptions.ts';
import { SyntaxKind } from 'typescript/unstable/ast';
import { nodes } from '#lib/ts-source.ts';

const STALE_FAILING_CALLS = new Accepted(['unexempted', 'unexemptedBy', 'mismatches', 'assertExact']);
const CONSULTING_METHODS = new Accepted([
  'includes',
  'has',
  'indexOf',
  'lastIndexOf',
  'get',
  'some',
  'every',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
]);
const COLLECTION_BUILDERS = new Accepted(['Set', 'Map']);

/**
 * The expression under any `as`, `satisfies` and parentheses.
 *
 * @param {Expression} value - The expression to unwrap.
 * @returns {Expression} The innermost expression.
 */
function unwrap(value: Expression): Expression {
  if (isAsExpression(value) || isSatisfiesExpression(value) || isParenthesizedExpression(value)) {
    return unwrap(value.expression);
  }
  return value;
}

/**
 * The callee a value is built by: `new X(…)`, or `X.grouped(…)`.
 *
 * @param {Expression} built - The unwrapped value.
 * @returns {Expression | undefined} The callee, or `undefined` for any other value.
 */
function builder(built: Expression): Expression | undefined {
  if (isNewExpression(built)) {
    return built.expression;
  }
  if (isCallExpression(built) && isPropertyAccessExpression(built.expression)) {
    const method = built.expression.name;
    return isIdentifier(method) && method.text === 'grouped' ? built.expression.expression : undefined;
  }
  return undefined;
}

/**
 * The declaration a module-level value builds, if it is one.
 *
 * @param {Expression} value - A module-level `const` initializer.
 * @returns {Kind | undefined} The declaration's kind, or `undefined`.
 */
function declaration(value: Expression): Kind | undefined {
  const callee = builder(unwrap(value));
  if (callee === undefined || !isIdentifier(callee)) {
    return undefined;
  }
  const { text } = callee;
  return KINDS.has(text) ? text : undefined;
}

/**
 * Whether a value is a literal collection: an array or object literal, or a `Set` or `Map` built from literals.
 *
 * @param {Expression} value - A module-level `const` initializer.
 * @returns {boolean} Whether the value is a literal collection.
 */
function isLiteral(value: Expression): boolean {
  const built = unwrap(value);
  if (isArrayLiteralExpression(built) || isObjectLiteralExpression(built)) {
    return true;
  }
  if (!isNewExpression(built) || !isIdentifier(built.expression) || !COLLECTION_BUILDERS.has(built.expression.text)) {
    return false;
  }
  const values = built.arguments ?? [];
  const [first] = values;
  return first !== undefined && values.every((argument) => isLiteral(argument));
}

/**
 * The module-level `const` bindings of a module, by name.
 *
 * @param {SourceFile} file - The parsed module.
 * @returns {ReadonlyMap<string, Expression>} Each binding's initializer, by name.
 */
function moduleBindings(file: SourceFile): ReadonlyMap<string, Expression> {
  const bindings = new Map<string, Expression>();
  for (const statement of file.statements.filter((candidate) => isVariableStatement(candidate))) {
    for (const binding of statement.declarationList.declarations) {
      if (isIdentifier(binding.name) && binding.initializer !== undefined) {
        bindings.set(binding.name.text, binding.initializer);
      }
    }
  }
  return bindings;
}

/**
 * The text of an identifier.
 *
 * @param {Node | undefined} node - Any node, or none.
 * @returns {string | undefined} The identifier's text, or `undefined` for anything else.
 */
function identifierText(node: Node | undefined): string | undefined {
  return node !== undefined && isIdentifier(node) ? node.text : undefined;
}

/**
 * A call's first argument.
 *
 * @param {CallExpression} call - The call.
 * @returns {Expression | undefined} Its first argument, if any.
 */
function firstArgument(call: CallExpression): Expression | undefined {
  const [first] = call.arguments;
  return first;
}

/**
 * The node a single node consults as a collection, by a method, `in`, `Object.hasOwn`, or a computed lookup.
 *
 * @param {Node} node - Any node.
 * @returns {Node | undefined} The consulted collection, or `undefined`.
 */
function consultedBy(node: Node): Node | undefined {
  if (isCallExpression(node) && isPropertyAccessExpression(node.expression)) {
    const method = identifierText(node.expression.name);
    if (method === 'hasOwn' && identifierText(node.expression.expression) === 'Object') {
      return firstArgument(node);
    }
    return method !== undefined && CONSULTING_METHODS.has(method) ? node.expression.expression : undefined;
  }
  if (isBinaryExpression(node) && node.operatorToken.kind === SyntaxKind.InKeyword) {
    return node.right;
  }
  if (isElementAccessExpression(node) && !isNumericLiteral(node.argumentExpression)) {
    return node.expression;
  }
  return undefined;
}

/**
 * The arguments a call hands to the parameters its helper consults.
 *
 * @param {Node} node - Any node.
 * @param {ReadonlyMap<string, ReadonlySet<number>>} helpers - Each module function's consulted parameter positions.
 * @returns {readonly Node[]} The consulted arguments.
 */
function consultedArguments(node: Node, helpers: ReadonlyMap<string, ReadonlySet<number>>): readonly Node[] {
  if (!isCallExpression(node)) {
    return [];
  }
  const positions = helpers.get(identifierText(node.expression) ?? '') ?? new Set<number>();
  const indexed: readonly (readonly [number, Expression])[] = [...node.arguments.entries()];
  return indexed.filter(([index]) => positions.has(index)).map(([, argument]) => argument);
}

/**
 * The names a tree consults as a collection, given the parameter positions each helper consults.
 *
 * @param {Node} root - The tree to search.
 * @param {ReadonlyMap<string, ReadonlySet<number>>} helpers - Each module function's consulted parameter positions.
 * @returns {ReadonlySet<string>} The consulted names.
 */
function consultedNames(root: Node, helpers: ReadonlyMap<string, ReadonlySet<number>> = new Map()): ReadonlySet<string> {
  const all = nodes(root);
  const consulted = [...all.map((node) => consultedBy(node)), ...all.flatMap((node) => consultedArguments(node, helpers))];
  return new Set(consulted.flatMap((node) => identifierText(node) ?? []));
}

/**
 * For each module function, the positions of the parameters it consults as a collection.
 *
 * @param {SourceFile} file - The parsed module.
 * @returns {ReadonlyMap<string, ReadonlySet<number>>} Each function's consulted parameter positions, by name.
 */
function consultingParameters(file: SourceFile): ReadonlyMap<string, ReadonlySet<number>> {
  return new Map(
    file.statements.flatMap((statement) => {
      if (!isFunctionDeclaration(statement) || statement.name === undefined) {
        return [];
      }
      const names = consultedNames(statement);
      const positions = new Set<number>();
      for (const [index, parameter] of statement.parameters.entries()) {
        if (names.has(identifierText(parameter.name) ?? '')) {
          positions.add(index);
        }
      }
      return [[statement.name.text, positions] as const];
    }),
  );
}

/**
 * The names one call or construction hands to a call, or consults with a call that fails on a stale entry.
 *
 * @param {Node} node - Any node.
 * @returns {readonly string[]} The receiving names.
 */
function receiversOf(node: Node): readonly string[] {
  if (!isCallExpression(node) && !isNewExpression(node)) {
    return [];
  }
  const handed = (node.arguments ?? []).flatMap((argument) => identifierText(argument) ?? []);
  if (!isPropertyAccessExpression(node.expression)) {
    return handed;
  }
  const method = identifierText(node.expression.name);
  const receiver = identifierText(node.expression.expression);
  return method !== undefined && receiver !== undefined && STALE_FAILING_CALLS.has(method) ? [receiver, ...handed] : handed;
}

/**
 * The names a tree hands to a call, or consults with a call that fails on a stale entry.
 *
 * @param {Node} root - The tree to search.
 * @returns {ReadonlySet<string>} The receiving names.
 */
function staleFailingReceivers(root: Node): ReadonlySet<string> {
  return new Set(nodes(root).flatMap((node) => receiversOf(node)));
}

/**
 * Whether an identifier is a read of a binding, not a declaration, an import or a property name.
 *
 * @param {Node} node - An identifier.
 * @returns {boolean} Whether the identifier reads a binding.
 */
function isRead(node: Node): boolean {
  const { parent } = node;
  return !(
    (isVariableDeclaration(parent) && parent.name === node) ||
    isImportSpecifier(parent) ||
    (isPropertyAccessExpression(parent) && parent.name === node) ||
    (isPropertyAssignment(parent) && parent.name === node)
  );
}

/**
 * The names a tree reads.
 *
 * @param {Node} root - The tree to search.
 * @returns {ReadonlySet<string>} The names read.
 */
function reads(root: Node): ReadonlySet<string> {
  return new Set(
    nodes(root)
      .filter((node) => isIdentifier(node) && isRead(node))
      .map((node) => identifierText(node) ?? ''),
  );
}

export { consultedNames, consultingParameters, declaration, isLiteral, moduleBindings, reads, staleFailingReceivers };
