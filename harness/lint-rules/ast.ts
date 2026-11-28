/**
 * The project lint rules' view of oxlint's plugin API: the ESTree node shape, the rule context and
 * the helpers every rule narrows nodes with. oxlint 1.94 exports none of its plugin types, so the
 * rules read nodes through these guards instead of casts.
 */

import { matches } from '#lint-rules/globs.ts';
import path from 'node:path';

/** An ESTree node as oxlint hands it to a visitor. */
interface Node {
  readonly type: string;
  readonly [key: string]: unknown;
}

/** What a rule reports: a message on a node. */
interface Report {
  readonly message: string;
  readonly node: Node;
}

/** The parts of oxlint's rule context the project rules read. */
interface Context {
  readonly filename: string;
  readonly cwd: string;
  readonly options: readonly unknown[];
  readonly report: (report: Report) => void;
}

/** A rule's visitor: a handler per node type (or `<type>:exit`). */
type Visitor = Readonly<Record<string, (node: Node) => void>>;

/** A project lint rule as oxlint loads it. */
interface Rule {
  readonly meta: {
    readonly type: 'problem';
    readonly docs: { readonly description: string };
    readonly schema: readonly unknown[];
  };
  readonly create: (context: Context) => Visitor;
}

/** A test of a file path, compiled from a glob. */
type FileTest = (file: string) => boolean;

/** The options schema every path-scoped rule accepts: globs of the files it does not hold. */
const IGNORE_SCHEMA: readonly unknown[] = [
  {
    additionalProperties: false,
    properties: { ignore: { items: { type: 'string' }, type: 'array' } },
    type: 'object',
  },
];

/** The options schema of a rule with owners: globs of the files allowed what the rule refuses. */
const OWNERS_SCHEMA: readonly unknown[] = [
  {
    additionalProperties: false,
    properties: { owners: { items: { type: 'string' }, type: 'array' } },
    type: 'object',
  },
];

/**
 * Whether a value is an ESTree node.
 * @param {unknown} value - The value to test.
 * @returns {boolean} Whether it is an object with a string `type`.
 */
function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
}

/**
 * The child node under `key`, if it is a node.
 * @param {Node} node - The parent node.
 * @param {string} key - The field holding the child.
 * @returns {Node | undefined} The child, or undefined when the field holds no node.
 */
function child(node: Node, key: string): Node | undefined {
  const value = node[key];
  return isNode(value) ? value : undefined;
}

/**
 * The child nodes under `key`, if it is an array.
 * @param {Node} node - The parent node.
 * @param {string} key - The field holding the children.
 * @returns {readonly Node[]} The nodes of the array, or none when the field is no array.
 */
function children(node: Node, key: string): readonly Node[] {
  const value = node[key];
  return Array.isArray(value) ? value.filter((entry) => isNode(entry)) : [];
}

/**
 * The string under `key`, if it is one.
 * @param {Node} node - The node to read.
 * @param {string} key - The field holding the string.
 * @returns {string | undefined} The string, or undefined when the field holds none.
 */
function text(node: Node, key: string): string | undefined {
  const value = node[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * The boolean under `key`; absent reads as false.
 * @param {Node} node - The node to read.
 * @param {string} key - The field holding the boolean.
 * @returns {boolean} Whether the field holds `true`.
 */
function flag(node: Node, key: string): boolean {
  return node[key] === true;
}

/**
 * The name of an `Identifier`, `JSXIdentifier` or `PrivateIdentifier`, or of a string literal.
 * @param {Node | undefined} node - The node to name.
 * @returns {string | undefined} Its name, or undefined when it has none.
 */
function nameOf(node: Node | undefined): string | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (node.type === 'Literal') {
    return text(node, 'value');
  }
  return text(node, 'name');
}

/**
 * The property name a member expression reads, when it is static (`a.b` or `a['b']`).
 * @param {Node} node - The node to read.
 * @returns {string | undefined} The property name, or undefined for any other node or a computed key.
 */
function memberName(node: Node): string | undefined {
  if (node.type !== 'MemberExpression') {
    return undefined;
  }
  const property = child(node, 'property');
  if (flag(node, 'computed')) {
    return property?.type === 'Literal' ? text(property, 'value') : undefined;
  }
  return nameOf(property);
}

/** A template's substitutions when it has none. */
const NO_SUBSTITUTION = 0;

/**
 * A template's text when it has no substitution.
 * @param {Node} template - A `TemplateLiteral`.
 * @returns {string | undefined} Its cooked text, or undefined when it has a substitution.
 */
function templateText(template: Node): string | undefined {
  const [quasi] = children(template, 'quasis');
  const value = quasi?.['value'];
  if (children(template, 'expressions').length !== NO_SUBSTITUTION || typeof value !== 'object' || value === null) {
    return undefined;
  }
  const cooked: unknown = Reflect.get(value, 'cooked');
  return typeof cooked === 'string' ? cooked : undefined;
}

/**
 * The module a module-level import, re-export or dynamic import names: a string, or a template
 * with no substitution, which names one module as a string does.
 * @param {Node} node - The import, export or import expression.
 * @returns {string | undefined} The module specifier, or undefined when it is not a literal.
 */
function moduleSource(node: Node): string | undefined {
  const source = child(node, 'source');
  if (source?.type === 'TemplateLiteral') {
    return templateText(source);
  }
  return source?.type === 'Literal' ? text(source, 'value') : undefined;
}

/**
 * The file being linted, relative to the directory oxlint runs in, in POSIX form.
 * @param {Context} context - The rule's context.
 * @returns {string} The linted file's relative POSIX path.
 */
function relativeFile(context: Context): string {
  return path.relative(context.cwd, context.filename).split(path.sep).join('/');
}

/**
 * The globs under `key` in the rule's first option object.
 * @param {Context} context - The rule's context.
 * @param {string} key - The option holding the globs.
 * @returns {readonly FileTest[]} The compiled globs, or none when the option is absent.
 */
function globs(context: Context, key: string): readonly FileTest[] {
  const [first] = context.options;
  if (typeof first !== 'object' || first === null || !Object.hasOwn(first, key)) {
    return [];
  }
  const value: unknown = Reflect.get(first, key);
  return Array.isArray(value)
    ? value
        .filter((entry) => typeof entry === 'string')
        .map(
          (glob) =>
            (file: string): boolean =>
              matches(glob, file),
        )
    : [];
}

/**
 * Whether the linted file matches one of the globs under `key`.
 * @param {Context} context - The rule's context.
 * @param {string} key - The option holding the globs.
 * @returns {boolean} Whether one glob matches the linted file.
 */
function optionMatches(context: Context, key: string): boolean {
  const file = relativeFile(context);
  return globs(context, key).some((test) => test(file));
}

/** A JSX module, of either language: the extensions JSX is written in. */
const JSX_MODULE = /\.[jt]sx$/u;

/**
 * Whether the linted file is a JSX module the rule holds (not under its `ignore` globs).
 * @param {Context} context - The rule's context.
 * @returns {boolean} Whether the rule applies to the linted file.
 */
function heldComponentFile(context: Context): boolean {
  return JSX_MODULE.test(context.filename) && !optionMatches(context, 'ignore');
}

/**
 * A rule's meta: every project rule reports a problem.
 * @param {string} description - The rule's one-line description.
 * @param {readonly unknown[]} schema - The rule's options schema.
 * @returns {Rule['meta']} The meta oxlint reads.
 */
function problemMeta(description: string, schema: readonly unknown[] = []): Rule['meta'] {
  return { docs: { description }, schema, type: 'problem' };
}

/**
 * A rule that holds component modules only: `.tsx` files outside its `ignore` globs.
 * @param {string} description - The rule's one-line description.
 * @param {Rule['create']} create - The visitor for a held file.
 * @returns {Rule} The rule.
 */
function componentRule(description: string, create: Rule['create']): Rule {
  return {
    create: (context) => (heldComponentFile(context) ? create(context) : {}),
    meta: problemMeta(description, IGNORE_SCHEMA),
  };
}

export type { Context, Node, Rule, Visitor };
export {
  child,
  children,
  componentRule,
  flag,
  memberName,
  moduleSource,
  nameOf,
  optionMatches,
  OWNERS_SCHEMA,
  problemMeta,
  relativeFile,
  text,
};
