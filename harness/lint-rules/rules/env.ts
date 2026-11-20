/** The environment is read in one place: no `process.env` outside the settings owners. */

import { child, children, matches, memberName, moduleSource, nameOf, OWNERS_SCHEMA, type Rule } from '../ast.ts';

const PROCESS = new Set(['process', 'node:process']);

export const env: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'No process.env read outside the settings owners (the `owners` globs).' },
    schema: OWNERS_SCHEMA,
  },
  create(context) {
    if (matches(context, 'owners')) {
      return {};
    }
    const message = 'the environment is read by its settings owner: take the value from it';
    return {
      MemberExpression(node) {
        if (nameOf(child(node, 'object')) === 'process' && memberName(node) === 'env') {
          context.report({ message, node });
        }
      },
      ImportDeclaration(node) {
        const source = moduleSource(node);
        const importsEnv = children(node, 'specifiers').some(
          (specifier) => specifier.type === 'ImportSpecifier' && nameOf(child(specifier, 'imported')) === 'env',
        );
        if (source !== undefined && PROCESS.has(source) && importsEnv) {
          context.report({ message, node });
        }
      },
    };
  },
};
