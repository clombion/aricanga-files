/** The environment is read in one place: no `process.env` outside the settings owners. */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { OWNERS_SCHEMA, child, children, memberName, moduleSource, nameOf, optionMatches, problemMeta } from '#lint-rules/ast.ts';
import { Accepted } from '#lint-rules/exemptions.ts';

const PROCESS = new Accepted<string>(['process', 'node:process']);
const MESSAGE = 'the environment is read by its settings owner: take the value from it';

/**
 * Whether an import names `env` from Node's `process` module.
 * @param {Node} node - An `ImportDeclaration`.
 * @returns {boolean} Whether it imports `env` from `process` or `node:process`.
 */
function importsEnv(node: Node): boolean {
  const source = moduleSource(node);
  return (
    source !== undefined &&
    PROCESS.has(source) &&
    children(node, 'specifiers').some((specifier) => specifier.type === 'ImportSpecifier' && nameOf(child(specifier, 'imported')) === 'env')
  );
}

export const env: Rule = {
  create(context) {
    if (optionMatches(context, 'owners')) {
      return {};
    }
    return {
      ImportDeclaration(node) {
        if (importsEnv(node)) {
          context.report({ message: MESSAGE, node });
        }
      },
      MemberExpression(node) {
        if (nameOf(child(node, 'object')) === 'process' && memberName(node) === 'env') {
          context.report({ message: MESSAGE, node });
        }
      },
    };
  },
  meta: problemMeta('No process.env read outside the settings owners (the `owners` globs).', OWNERS_SCHEMA),
};
