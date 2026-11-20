/**
 * The project lint rules' view of oxlint's plugin API: the ESTree node shape, the rule context and
 * the helpers every rule narrows nodes with. oxlint 1.94 exports none of its plugin types, so the
 * rules read nodes through these guards instead of casts.
 */

import { relative, sep } from 'node:path';

/** An ESTree node as oxlint hands it to a visitor. */
export interface Node {
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface Report {
  readonly message: string;
  readonly node: Node;
}

/** The parts of oxlint's rule context the project rules read. */
export interface Context {
  readonly filename: string;
  readonly cwd: string;
  readonly options: readonly unknown[];
  report(this: void, report: Report): void;
}

export type Visitor = Record<string, (node: Node) => void>;

export interface Rule {
  readonly meta: {
    readonly type: 'problem';
    readonly docs: { readonly description: string };
    readonly schema: readonly unknown[];
  };
  create(context: Context): Visitor;
}

/** The options schema every path-scoped rule accepts: globs of the files it does not hold. */
export const IGNORE_SCHEMA: readonly unknown[] = [
  {
    type: 'object',
    properties: { ignore: { type: 'array', items: { type: 'string' } } },
    additionalProperties: false,
  },
];

/** The options schema of a rule with owners: globs of the files allowed what the rule refuses. */
export const OWNERS_SCHEMA: readonly unknown[] = [
  {
    type: 'object',
    properties: { owners: { type: 'array', items: { type: 'string' } } },
    additionalProperties: false,
  },
];

export function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
}

/** The child node under `key`, if it is a node. */
export function child(node: Node, key: string): Node | undefined {
  const value = node[key];
  return isNode(value) ? value : undefined;
}

/** The child nodes under `key`, if it is an array. */
export function children(node: Node, key: string): readonly Node[] {
  const value = node[key];
  return Array.isArray(value) ? value.filter(isNode) : [];
}

/** The string under `key`, if it is one. */
export function text(node: Node, key: string): string | undefined {
  const value = node[key];
  return typeof value === 'string' ? value : undefined;
}

/** The boolean under `key`; absent reads as false. */
export function flag(node: Node, key: string): boolean {
  return node[key] === true;
}

/** The name of an `Identifier`, `JSXIdentifier` or `PrivateIdentifier`, or of a string literal. */
export function nameOf(node: Node | undefined): string | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (node.type === 'Literal') {
    return text(node, 'value');
  }
  return text(node, 'name');
}

/** The property name a member expression reads, when it is static (`a.b` or `a['b']`). */
export function memberName(node: Node): string | undefined {
  if (node.type !== 'MemberExpression') {
    return undefined;
  }
  const property = child(node, 'property');
  if (flag(node, 'computed')) {
    return property?.type === 'Literal' ? text(property, 'value') : undefined;
  }
  return nameOf(property);
}

/** The module a module-level import, re-export or dynamic import names. */
export function moduleSource(node: Node): string | undefined {
  const source = child(node, 'source');
  return source?.type === 'Literal' ? text(source, 'value') : undefined;
}

/** The JSX attributes of an opening element, by name (`on:input` keeps its namespace). */
export function jsxAttributes(opening: Node): ReadonlyMap<string, Node> {
  const found = new Map<string, Node>();
  for (const attribute of children(opening, 'attributes')) {
    if (attribute.type !== 'JSXAttribute') {
      continue;
    }
    const name = child(attribute, 'name');
    if (name?.type === 'JSXNamespacedName') {
      found.set(`${nameOf(child(name, 'namespace')) ?? ''}:${nameOf(child(name, 'name')) ?? ''}`, attribute);
    } else {
      const plain = nameOf(name);
      if (plain !== undefined) {
        found.set(plain, attribute);
      }
    }
  }
  return found;
}

/** The tag name of a JSX opening element (`div`, `Loading`); a member tag reads as undefined. */
export function jsxName(opening: Node): string | undefined {
  const name = child(opening, 'name');
  return name?.type === 'JSXIdentifier' ? text(name, 'name') : undefined;
}

/** The file being linted, relative to the directory oxlint runs in, in POSIX form. */
export function relativeFile(context: Context): string {
  return relative(context.cwd, context.filename).split(sep).join('/');
}

function globToRegExp(glob: string): RegExp {
  const pattern = glob
    .split('**')
    .map((part) => part.replaceAll(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*'))
    .join('.*');
  return new RegExp(`^${pattern}$`);
}

/** The globs under `key` in the rule's first option object. */
export function globs(context: Context, key: string): readonly RegExp[] {
  const [first] = context.options;
  if (typeof first !== 'object' || first === null || !(key in first)) {
    return [];
  }
  const value: unknown = Object.entries(first).find(([name]) => name === key)?.[1];
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string').map(globToRegExp) : [];
}

/** Whether the linted file matches one of the globs under `key`. */
export function matches(context: Context, key: string): boolean {
  const file = relativeFile(context);
  return globs(context, key).some((glob) => glob.test(file));
}

/** Whether the linted file is a `.tsx` module the rule holds (not under its `ignore` globs). */
export function heldComponentFile(context: Context): boolean {
  return context.filename.endsWith('.tsx') && !matches(context, 'ignore');
}
