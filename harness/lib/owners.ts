/**
 * The owner registry: for each guarded API, the one module per root allowed to use it.
 *
 * A `Rule` names the qualified names of the declarations that make up an API and, for each root it
 * covers, that root's owner: the one module allowed to use it there, or null when no module may.
 * The scan asks TypeScript's checker what each name resolves to, so an aliased import, a destructured
 * binding, a `globalThis.` or `window.` chain and an element access all resolve to the declaration
 * they stand for. It matches uses, never imports or types: importing a type to annotate with it is
 * not a use. It cannot see a use reached through `eval`, `Reflect.get` with a computed key, or a
 * callable passed in from outside the covered roots.
 */

import ts from 'typescript';

import { type Scan, nodes, pathOf, propertyName, qualifiedNames, resolved } from './checker.ts';
import { Accepted, site } from './exemptions.ts';

/** A root a rule covers, and its owner there (null: no module of the root may use the API). */
export interface Scope {
  readonly root: string;
  readonly owner: string | null;
}

/** A guarded API: the declarations that make it up, the roots it covers, and why it has an owner. */
export interface Rule {
  readonly name: string;
  readonly names: Accepted<string>;
  readonly scopes: readonly Scope[];
  readonly why: string;
}

const KERNEL = ['packages/foundation/', 'packages/systems/'];

function nobody(...roots: string[]): Scope[] {
  return roots.map((root) => ({ root, owner: null }));
}

export const RULES: readonly Rule[] = [
  {
    name: 'process-start',
    names: new Accepted(
      ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'].map((call) => `child_process.${call}`),
    ),
    scopes: [...nobody(...KERNEL, 'experiences/sandbox/'), { root: 'harness/', owner: 'harness/lib/process.ts' }],
    why: 'every child process is bounded and its outcome is one of three',
  },
  {
    name: 'clock',
    names: new Accepted(['DateConstructor.now', 'new Date()', 'Date()', 'Performance.now', 'Process.hrtime']),
    scopes: nobody(...KERNEL, 'experiences/sandbox/', 'harness/'),
    why: 'time is simulation-derived: the kernel reads it from its input, a host from its injected clock',
  },
  {
    name: 'random',
    names: new Accepted([
      'Math.random',
      'Crypto.randomUUID',
      'Crypto.getRandomValues',
      'crypto.randomUUID',
      'crypto.randomBytes',
      'crypto.randomInt',
      'crypto.getRandomValues',
    ]),
    scopes: nobody(...KERNEL, 'experiences/sandbox/', 'harness/'),
    why: 'ids and draws come from the seed, so a run replays',
  },
  {
    name: 'standard-streams',
    names: new Accepted(['console', 'Process.stdout', 'Process.stderr']),
    scopes: [
      ...nobody(...KERNEL, 'experiences/sandbox/'),
      { root: 'harness/', owner: 'harness/lib/output.ts' },
      { root: 'packages/characterisation/', owner: 'packages/characterisation/src/harness.ts' },
    ],
    why: 'the kernel reports through effects and the event bus; one module of a tool says what it says',
  },
  {
    name: 'json-parse',
    names: new Accepted(['JSON.parse']),
    scopes: [...nobody(...KERNEL, 'experiences/sandbox/'), { root: 'harness/', owner: 'harness/lib/config.ts' }],
    why: "one typed boundary narrows JSON's untyped values",
  },
  {
    name: 'network',
    names: new Accepted([
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
      'Navigator.sendBeacon',
      'http.request',
      'http.get',
      'https.request',
      'https.get',
      'net.connect',
      'net.createConnection',
    ]),
    scopes: [
      ...nobody(...KERNEL, 'harness/'),
      { root: 'experiences/sandbox/', owner: 'experiences/sandbox/src/main.ts' },
    ],
    why: "data reaches the kernel through the Fetch effect; one module of a host makes the request",
  },
  {
    name: 'timers',
    names: new Accepted([
      'setTimeout',
      'setInterval',
      'setImmediate',
      'requestAnimationFrame',
      'requestIdleCallback',
    ]),
    scopes: nobody(...KERNEL, 'experiences/sandbox/', 'harness/'),
    why: "time passes through the injected Scheduler, so a test drives it",
  },
  {
    name: 'storage',
    names: new Accepted(['localStorage', 'sessionStorage', 'indexedDB', 'Document.cookie', 'caches']),
    scopes: nobody(...KERNEL, 'experiences/sandbox/', 'harness/', 'packages/characterisation/'),
    why: 'saves go through the Persist effect and the injected Store',
  },
  {
    name: 'settings',
    names: new Accepted(['Process.env']),
    scopes: [
      ...nobody(...KERNEL, 'experiences/sandbox/'),
      { root: 'harness/', owner: 'harness/lib/process.ts' },
      {
        root: 'packages/characterisation/',
        owner: 'packages/characterisation/playwright.characterisation.config.ts',
      },
    ],
    why: 'every setting is read once, in one module',
  },
];

/** One use of a guarded API outside its owner: the file it is in and the rule it breaks. */
export interface Site {
  readonly path: string;
  readonly rule: string;
}

/** The key of a site in an exemption declaration. */
export function keyOf(found: Site): string {
  return site(found.path, found.rule);
}

/** Strip a `node:` module prefix and the quotes around a module name: `"node:fs".x` reads `fs.x`. */
function normalised(name: string): string {
  return name.replace(/^"(?:node:)?([^"]+)"\./, '$1.').replace(/^global\.NodeJS\./, '');
}

function inTypeOrImport(node: ts.Node): boolean {
  for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
    if (
      ts.isTypeNode(current) ||
      ts.isImportDeclaration(current) ||
      ts.isExportDeclaration(current) ||
      ts.isImportEqualsDeclaration(current) ||
      ts.isTypeAliasDeclaration(current) ||
      ts.isInterfaceDeclaration(current) ||
      ts.isHeritageClause(current)
    ) {
      return true;
    }
    if (ts.isStatement(current) || ts.isSourceFile(current)) {
      return false;
    }
  }
  return false;
}

/** Whether a node is the name a declaration introduces, not a read of one. */
function declares(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (
    ((ts.isVariableDeclaration(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isBindingElement(parent)) &&
      parent.name === node) ||
    (ts.isPropertyAccessExpression(parent) && parent.name === node)
  );
}

/**
 * Whether a symbol is declared by the platform (a `lib` file or a package's types), so a module's
 * own `fetch` or `now` never reads as the platform's.
 */
function platform(scan: Scan, symbol: ts.Symbol | undefined): boolean {
  const declarations = resolved(scan.checker, symbol)?.declarations ?? [];
  return (
    declarations.length > 0 &&
    declarations.every((declaration) => {
      const file = declaration.getSourceFile();
      return scan.program.isSourceFileDefaultLibrary(file) || file.fileName.includes('/node_modules/');
    })
  );
}

/** The qualified names every runtime use in a file resolves to. */
export function uses(scan: Scan, file: ts.SourceFile): readonly string[] {
  const { checker } = scan;
  const found: string[] = [];
  const add = (symbol: ts.Symbol | undefined): void => {
    if (platform(scan, symbol)) {
      found.push(...qualifiedNames(checker, symbol).map(normalised));
    }
  };
  for (const node of nodes(file)) {
    if (inTypeOrImport(node)) {
      continue;
    }
    if (ts.isNewExpression(node) && (node.arguments?.length ?? 0) === 0) {
      if (qualifiedNames(checker, checker.getSymbolAtLocation(node.expression)).includes('Date')) {
        found.push('new Date()');
      }
    } else if (ts.isCallExpression(node) && qualifiedNames(checker, checker.getSymbolAtLocation(node.expression)).includes('Date')) {
      found.push('Date()');
    }
    if (ts.isPropertyAccessExpression(node)) {
      add(checker.getSymbolAtLocation(node.name));
    } else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      add(checker.getPropertyOfType(checker.getTypeAtLocation(node.expression), node.argumentExpression.text));
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const name = propertyName(node.propertyName ?? node.name);
      if (name !== undefined) {
        add(checker.getPropertyOfType(checker.getTypeAtLocation(node.parent), name));
      }
    } else if (ts.isIdentifier(node) && !declares(node)) {
      add(checker.getSymbolAtLocation(node));
    }
  }
  return found;
}

function breaks(rule: Rule, found: readonly string[]): boolean {
  return found.some((name) => rule.names.has(name) || [...rule.names].some((member) => name.startsWith(`${member}.`)));
}

/** The guarded uses in a covered file that its rules do not allow there. */
export function sites(scan: Scan, file: ts.SourceFile): readonly Site[] {
  const path = pathOf(file);
  const found = uses(scan, file);
  return RULES.filter((rule) => {
    const scope = rule.scopes.find((candidate) => path.startsWith(candidate.root));
    return scope !== undefined && scope.owner !== path && breaks(rule, found);
  }).map((rule) => ({ path, rule: rule.name }));
}

/** Whether a module uses the rule's API: an owner that does not is stale. */
export function ownerUses(scan: Scan, file: ts.SourceFile, rule: Rule): boolean {
  return breaks(rule, uses(scan, file));
}
