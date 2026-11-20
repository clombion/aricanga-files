/**
 * Every literal list a check consults is an exemption declaration, and every declaration is consulted.
 *
 * Over the modules of `harness/checks` and `harness/lib`: a module-level array, object, or pre-filled
 * `Set` or `Map` literal (through `as const` and `satisfies`) that the module consults — with
 * `includes`, `has`, `indexOf`, `get`, `some`, `every`, `find`, `in`, a computed lookup
 * `NAME[key]`, or by handing it to a module function that does one of these with its parameter —
 * must be declared through `harness/lib/exemptions.ts`. Iterating a list is not consulting it.
 *
 * A declaration nothing consults is stale: an `Exemptions` or `CountedExemptions` is consulted by a
 * call that fails on a stale entry (`unexempted`, `unexemptedBy`, `mismatches`, `assertExact`) or
 * by being handed to a call, which is trusted to make one; an `Accepted` or `Prefixes` by any read.
 * Reads in importing modules count. The fence cannot see a collection built at run time, nor
 * tolerance applied inside a helper of another module.
 */

import { SyntaxKind } from 'typescript/unstable/ast';
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
import { dirname, join, normalize } from 'node:path/posix';
import { describe, expect, test } from 'vitest';

import { Accepted, Exemptions, StaleExemptionError, site } from '../lib/exemptions.ts';
import { heldFiles } from '../lib/scope.ts';
import { textOf } from '../lib/source-files.ts';
import { type Expression, importsFrom, type Node, type SourceFile, nodes, parse } from '../lib/ts-source.ts';

export const HARNESS_ID = 'exemption-lists';

/** The four declarations of `harness/lib/exemptions.ts`. */
const DECLARATIONS = new Accepted(['Exemptions', 'CountedExemptions', 'Accepted', 'Prefixes']);
/** Declarations whose consult is a call that fails on a stale entry. */
const CONSULTED_BY_CALL = new Accepted(['Exemptions', 'CountedExemptions']);
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

/** Consulted literal lists the harness still holds while the fence is adopted, keyed by `site(path, name)`. */
const ADOPTING = new Exemptions({
  [site('harness/checks/boundaries.test.ts', 'BOUNDARY_RULES')]: 'adopting: declare it as an Accepted and ask .has',
  [site('harness/checks/gate.test.ts', 'GATE_TESTS')]: 'adopting: declare it as an Accepted of the commands check must run',
  [site('harness/lib/scope.ts', 'ROOTS')]: 'adopting: declare it as Prefixes and ask .starts',
});

/** A list the fence refuses: its module, its name and why. */
interface Finding {
  readonly path: string;
  readonly name: string;
  readonly problem: string;
}

const UNDECLARED = 'a literal collection consulted as a list: declare it';
const UNCONSULTED = 'a declaration nothing consults: delete it';

function unwrap(value: Expression): Expression {
  if (isAsExpression(value) || isSatisfiesExpression(value) || isParenthesizedExpression(value)) {
    return unwrap(value.expression);
  }
  return value;
}

/** The declaration a module-level value builds, if it is one. */
function declaration(value: Expression): string | undefined {
  const built = unwrap(value);
  let callee: Expression | undefined;
  if (isNewExpression(built)) {
    callee = built.expression;
  } else if (isCallExpression(built) && isPropertyAccessExpression(built.expression)) {
    const method = built.expression.name;
    callee = isIdentifier(method) && method.text === 'grouped' ? built.expression.expression : undefined;
  }
  return callee !== undefined && isIdentifier(callee) && DECLARATIONS.has(callee.text) ? callee.text : undefined;
}

function isLiteral(value: Expression): boolean {
  const built = unwrap(value);
  if (isArrayLiteralExpression(built) || isObjectLiteralExpression(built)) {
    return true;
  }
  return (
    isNewExpression(built) &&
    isIdentifier(built.expression) &&
    COLLECTION_BUILDERS.has(built.expression.text) &&
    built.arguments !== undefined &&
    built.arguments.length > 0 &&
    built.arguments.every((argument) => isLiteral(argument))
  );
}

/** The module-level `const` bindings of a module, by name. */
function moduleBindings(file: SourceFile): ReadonlyMap<string, Expression> {
  const bindings = new Map<string, Expression>();
  for (const statement of file.statements) {
    if (isVariableStatement(statement)) {
      for (const declared of statement.declarationList.declarations) {
        if (isIdentifier(declared.name) && declared.initializer !== undefined) {
          bindings.set(declared.name.text, declared.initializer);
        }
      }
    }
  }
  return bindings;
}

function identifierText(node: Node | undefined): string | undefined {
  return node !== undefined && isIdentifier(node) ? node.text : undefined;
}

/** The names a tree consults as a collection, given the parameter positions each helper consults. */
function consultedNames(root: Node, helpers: ReadonlyMap<string, ReadonlySet<number>> = new Map()): Set<string> {
  const consulted = new Set<string>();
  const add = (node: Node | undefined): void => {
    const name = identifierText(node);
    if (name !== undefined) {
      consulted.add(name);
    }
  };
  for (const node of nodes(root)) {
    if (isCallExpression(node) && isPropertyAccessExpression(node.expression)) {
      const method = identifierText(node.expression.name);
      if (method !== undefined && CONSULTING_METHODS.has(method)) {
        add(node.expression.expression);
      }
    }
    if (isBinaryExpression(node) && node.operatorToken.kind === SyntaxKind.InKeyword) {
      add(node.right);
    }
    if (isElementAccessExpression(node) && !isNumericLiteral(node.argumentExpression)) {
      add(node.expression);
    }
    if (isCallExpression(node)) {
      const positions = helpers.get(identifierText(node.expression) ?? '') ?? new Set<number>();
      node.arguments.forEach((argument, index) => {
        if (positions.has(index)) {
          add(argument);
        }
      });
    }
  }
  return consulted;
}

/** For each module function, the positions of the parameters it consults as a collection. */
function consultingParameters(file: SourceFile): ReadonlyMap<string, ReadonlySet<number>> {
  const found = new Map<string, ReadonlySet<number>>();
  for (const statement of file.statements) {
    if (isFunctionDeclaration(statement) && statement.name !== undefined) {
      const consulted = consultedNames(statement);
      const positions = new Set<number>();
      statement.parameters.forEach((parameter, index) => {
        const name = identifierText(parameter.name);
        if (name !== undefined && consulted.has(name)) {
          positions.add(index);
        }
      });
      found.set(statement.name.text, positions);
    }
  }
  return found;
}

/** The names a tree hands to a call, or consults with a call that fails on a stale entry. */
function staleFailingReceivers(root: Node): Set<string> {
  const found = new Set<string>();
  for (const node of nodes(root)) {
    if (isCallExpression(node) || isNewExpression(node)) {
      if (isPropertyAccessExpression(node.expression)) {
        const method = identifierText(node.expression.name);
        const receiver = identifierText(node.expression.expression);
        if (method !== undefined && receiver !== undefined && STALE_FAILING_CALLS.has(method)) {
          found.add(receiver);
        }
      }
      for (const argument of node.arguments ?? []) {
        const name = identifierText(argument);
        if (name !== undefined) {
          found.add(name);
        }
      }
    }
  }
  return found;
}

/** Whether an identifier is a read of a binding, not a declaration, an import or a property name. */
function isRead(node: Node): boolean {
  const parent = node.parent;
  return !(
    (isVariableDeclaration(parent) && parent.name === node) ||
    isImportSpecifier(parent) ||
    (isPropertyAccessExpression(parent) && parent.name === node) ||
    (isPropertyAssignment(parent) && parent.name === node)
  );
}

function reads(root: Node): Set<string> {
  return new Set(
    nodes(root)
      .filter((node) => isIdentifier(node) && isRead(node))
      .map((node) => identifierText(node) ?? ''),
  );
}

/** Whether a module at `path` names the module at `target` with `specifier`. */
function namesModule(path: string, target: string): (specifier: string) => boolean {
  return (specifier) => specifier.startsWith('.') && normalize(join(dirname(path), specifier)) === target;
}

/** The fence's findings over `{path: source}` of harness modules. */
export function findings(modules: Readonly<Record<string, string>>): Finding[] {
  const files = new Map(Object.entries(modules).map(([path, text]) => [path, parse(path, text)] as const));
  const found: Finding[] = [];
  for (const [path, file] of files) {
    const consulted = consultedNames(file, consultingParameters(file));
    const importers = [...files].filter(([otherPath]) => otherPath !== path);
    for (const [name, value] of moduleBindings(file)) {
      const kind = declaration(value);
      if (kind === undefined) {
        if (isLiteral(value) && consulted.has(name)) {
          found.push({ path, name, problem: UNDECLARED });
        }
        continue;
      }
      const users = [
        file,
        ...importers.filter(([otherPath, other]) => importsFrom(other, namesModule(otherPath, path)).has(name)).map(([, other]) => other),
      ];
      const live = CONSULTED_BY_CALL.has(kind)
        ? users.some((user) => staleFailingReceivers(user).has(name))
        : users.some((user) => reads(user).has(name));
      if (!live) {
        found.push({ path, name, problem: UNCONSULTED });
      }
    }
  }
  return found;
}

describe('the repository', () => {
  test('every consulted list is declared and every declaration is consulted', () => {
    const modules = Object.fromEntries(
      heldFiles('.ts')
        .filter((path) => path.startsWith('harness/checks/') || path.startsWith('harness/lib/'))
        .map((path) => [path, textOf(path)]),
    );
    expect(ADOPTING.unexemptedBy(findings(modules), (finding) => site(finding.path, finding.name))).toEqual([]);
  });
});

describe('the fence', () => {
  const P = 'harness/checks/plant.test.ts';

  test.each([
    'NAMES.includes(x)',
    'NAMES.has(x)',
    'NAMES.indexOf(x)',
    'NAMES.get(x)',
    'NAMES.some((name) => name === x)',
    'NAMES.every((name) => name !== x)',
    'NAMES.find((name) => name === x)',
    'x in NAMES',
    'NAMES[x]',
    'helper(NAMES)',
  ])('sees a literal consulted by %s', (consult) => {
    for (const literal of ["['a', 'b']", "{ a: 1 }", "new Set(['a'])", "new Map([['a', 1]])", "['a'] as const"]) {
      const source = `const NAMES = ${literal};\nfunction helper(values: readonly string[]) { return values.includes('a'); }\nexport function check(x: string) { return ${consult}; }\n`;
      expect(findings({ [P]: source })).toEqual([{ path: P, name: 'NAMES', problem: UNDECLARED }]);
    }
  });

  test.each([
    "const NAMES = ['a', 'b'];\nexport function check() { for (const name of NAMES) { void name; } }",
    "const NAMES = ['a'];\nexport const upper = NAMES.map((name) => name.toUpperCase());",
    "const NAMES = new Accepted(['a']);\nexport const has = NAMES.has('a');",
    "const EXEMPT = Exemptions.grouped({});\nexport function check() { EXEMPT.unexempted([]); }",
    "const COUNTED = new CountedExemptions({});\nexport function check() { COUNTED.assertExact([]); }",
    "const EXEMPT = new Exemptions({ a: 'why' });\nexport function check() { scan(EXEMPT); }",
    "const STARTS = new Prefixes(['a']);\nexport const starts = STARTS.starts('ab');",
    "const NAMES = ['a'];\nfunction helper(values: readonly string[]) { return values.length; }\nexport const n = helper(NAMES);",
    "const cache = new Map<string, number>();\nexport const hit = cache.get('a');",
    "const FIRST = ['a', 'b'];\nexport const first = FIRST[0];",
  ])('lets a declared, iterated or run-time list through: %j', (source) => {
    expect(findings({ [P]: source })).toEqual([]);
  });

  test.each([
    "const NAME = new Exemptions({ a: 'why' });",
    "const NAME = Exemptions.grouped({ why: ['a'] });\nexport const size = NAME.entries.size;",
    "const NAME = new CountedExemptions({ a: [1, 'why'] });",
    "const NAME = new Accepted(['a']);",
    "const NAME = new Prefixes(['a']);",
  ])('sees a declaration nothing consults: %j', (source) => {
    expect(findings({ [P]: source })).toEqual([{ path: P, name: 'NAME', problem: UNCONSULTED }]);
  });

  test('a declaration consulted by an importing module is live', () => {
    const owner = "export const EXEMPT = new Exemptions({ a: 'why' });\nexport const NAMES = new Accepted(['a']);\n";
    const user = "import { EXEMPT, NAMES } from '../lib/planted.ts';\nexport function check() { EXEMPT.unexempted(['a']); return NAMES.has('a'); }\n";
    expect(findings({ 'harness/lib/planted.ts': owner, [P]: user })).toEqual([]);
  });

  test('a stale adopting entry fails', () => {
    const adopting = new Exemptions({ [site(P, 'GONE')]: 'planted' });
    expect(() => adopting.unexemptedBy([], (finding: Finding) => site(finding.path, finding.name))).toThrow(StaleExemptionError);
  });
});
