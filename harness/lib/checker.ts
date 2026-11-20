/**
 * The one owner of the TypeScript programs the harness's type-aware scans read.
 *
 * A scan asks TypeScript 7's own checker (`typescript/unstable/sync`, served by `tsgo`) what each name
 * resolves to, so an alias, a destructured binding or a property chain resolves to the declaration it
 * stands for. The repository scan covers the held production modules (not tests or specs). A planted
 * scan holds in-memory sources at paths under the repository root, served through the API's virtual
 * file system, so its imports, `lib` and `@types` resolve exactly as the repository's do.
 */

import { join } from 'node:path';

import * as ast from 'typescript/unstable/ast';
import { API, type Checker, type Program, type Symbol as TsSymbol, SymbolFlags } from 'typescript/unstable/sync';

import { REPO_ROOT, relative } from './paths.ts';
import { typescriptFiles } from './scope.ts';
import { textOf } from './source-files.ts';

/** The compiler options of a scan: the shared base's strictness, every lib a held module reads. */
export const OPTIONS = {
  target: 'es2022',
  module: 'esnext',
  moduleResolution: 'bundler',
  lib: ['es2023', 'dom', 'dom.iterable'],
  types: ['node', 'vite/client'],
  jsx: 'preserve',
  jsxImportSource: '@solidjs/web',
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
} as const;

/** The virtual project file a scan opens; it never exists on disk. */
const CONFIG = join(REPO_ROOT, '.harness-scan', 'tsconfig.json');

/**
 * A held module that ships: TypeScript, not a Vitest test, a Playwright spec, or test support under a
 * `test/`, `tests/` or `testing/` directory.
 */
export function isProduction(path: string): boolean {
  return (
    /\.tsx?$/.test(path) &&
    !/\.(test|spec)\.tsx?$/.test(path) &&
    !path.endsWith('.d.ts') &&
    !/(^|\/)(test|tests|testing)\//.test(path)
  );
}

/** The held production modules the repository scan covers. */
export function productionFiles(): readonly string[] {
  return typescriptFiles().filter(isProduction);
}

/** An open program and its checker over repository-relative paths. Close it when done. */
export interface Scan {
  readonly program: Program;
  readonly checker: Checker;
  readonly paths: readonly string[];
  readonly close: () => void;
}

/**
 * A scan over `paths`. `sources` ({path: text}) overlay the real files: a planted path need not exist
 * on disk, and a real path read from `sources` sees the overlay's text.
 */
export function openScan(paths: readonly string[], sources: Readonly<Record<string, string>> = {}): Scan {
  const files = new Map<string, string>(Object.entries(sources).map(([path, text]) => [join(REPO_ROOT, path), text]));
  files.set(CONFIG, JSON.stringify({ compilerOptions: OPTIONS, files: paths.map((path) => join(REPO_ROOT, path)) }));
  const api = new API({
    cwd: REPO_ROOT,
    fs: {
      readFile: (name) => files.get(name),
      fileExists: (name) => (files.has(name) ? true : undefined),
    },
  });
  const project = api.updateSnapshot({ openProjects: [CONFIG] }).getProject(CONFIG);
  if (project === undefined) {
    api.close();
    throw new Error('the scan project did not open');
  }
  return { program: project.program, checker: project.checker, paths, close: () => api.close() };
}

/** A scan over in-memory sources only ({path: text}, paths relative to the root). */
export function planted(sources: Readonly<Record<string, string>>): Scan {
  return openScan(Object.keys(sources), sources);
}

/** A scan over every held production module. */
export function repositoryScan(): Scan {
  const paths = productionFiles();
  return openScan(paths, Object.fromEntries(paths.map((path) => [path, textOf(path)])));
}

/** The source file of a covered path. */
export function sourceOf(scan: Scan, path: string): ast.SourceFile {
  const file = scan.program.getSourceFile(join(REPO_ROOT, path));
  if (file === undefined) {
    throw new Error(`the scan does not cover ${path}`);
  }
  return file;
}

/** The repository-relative path of a source file. */
export function pathOf(file: ast.SourceFile): string {
  return relative(file.fileName);
}

/** Every node of a source file, depth first. */
export function nodes(file: ast.SourceFile): ast.Node[] {
  const found: ast.Node[] = [];
  const visit = (node: ast.Node): void => {
    found.push(node);
    node.forEachChild(visit);
  };
  visit(file);
  return found;
}

/** The source text of a node, without its leading trivia. */
export function textOfNode(node: ast.Node): string {
  const file = node.getSourceFile();
  return file.text.slice(node.getStart(file), node.getEnd());
}

/** The symbol a name stands for, through import and export aliases. */
export function resolved(checker: Checker, symbol: TsSymbol | undefined): TsSymbol | undefined {
  if (symbol !== undefined && (symbol.flags & SymbolFlags.Alias) !== 0) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

/**
 * The qualified name of the declaration a symbol resolves to, through its parents:
 * `Math.random`, `DateConstructor.now`, `child_process.spawn`, `NodeJS.Process.env`. A module's quotes
 * and `node:` prefix are dropped, and so is Node's `__global` wrapper.
 */
export function qualifiedName(checker: Checker, symbol: TsSymbol | undefined): string | undefined {
  const target = resolved(checker, symbol);
  if (target === undefined) {
    return undefined;
  }
  const names: string[] = [];
  for (let current: TsSymbol | undefined = target; current !== undefined; current = current.getParent()) {
    names.unshift(current.name.replace(/^"(?:node:)?([^"]+)"$/, '$1'));
  }
  return names.filter((name) => name !== '__global').join('.');
}

/** Whether a symbol is declared by the platform: a `lib` file or an installed package's types. */
export function isPlatform(checker: Checker, symbol: TsSymbol | undefined): boolean {
  const declarations = resolved(checker, symbol)?.declarations ?? [];
  return declarations.length > 0 && declarations.every((declaration) => declaration.path.includes('/node_modules/'));
}

/** The text of a property or binding name, or undefined for a computed one. */
export function nameText(name: ast.Node | undefined): string | undefined {
  if (name !== undefined && (ast.isIdentifier(name) || ast.isStringLiteral(name) || ast.isPrivateIdentifier(name))) {
    return name.text;
  }
  return undefined;
}
