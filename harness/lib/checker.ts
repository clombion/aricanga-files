/**
 * The harness's type-aware scans: programs whose checker says what each name resolves to.
 *
 * A scan opens a project on the one TypeScript 7 session of harness/lib/ts-source.ts, through a
 * virtual project file listing the paths it covers. An alias, a destructured binding or a property
 * chain resolves to the declaration it stands for. A planted scan mounts in-memory sources at paths
 * under the repository root, so their imports, `lib` and `@types` resolve exactly as the repository's
 * do. Every held module is scanned: tests, scripts and configs are held to the rules production
 * code is.
 */

import { join } from 'node:path';

import * as ast from 'typescript/unstable/ast';
import type { Checker, Program, Symbol as TsSymbol } from 'typescript/unstable/sync';
import { SymbolFlags } from 'typescript/unstable/sync';

import { Prefixes } from './exemptions.ts';
import { REPO_ROOT, relative } from './paths.ts';
import { typescriptFiles } from './scope.ts';
import { api, mount, nodes } from './ts-source.ts';

export { nodes };

/** The compiler options of a scan: the shared base's strictness, every lib a held module reads. */
const OPTIONS = {
  allowImportingTsExtensions: true,
  jsx: 'preserve',
  jsxImportSource: '@solidjs/web',
  lib: ['es2023', 'dom', 'dom.iterable'],
  module: 'esnext',
  moduleResolution: 'bundler',
  noEmit: true,
  skipLibCheck: true,
  strict: true,
  target: 'es2022',
  types: ['node', 'vite/client'],
} as const;

/** Test infrastructure packages: they exist only to test, so every module of theirs is test support. */
const TEST_PACKAGES = new Prefixes(['packages/characterisation/']);

/** Whether a module belongs to a test infrastructure package (run by Playwright, not by Vitest). */
export function isTestInfrastructure(path: string): boolean {
  return TEST_PACKAGES.starts(path);
}

/**
 * A module that ships: not a Vitest test, a Playwright spec, test support under a `test/`, `tests/`
 * or `testing/` directory, or a module of a test infrastructure package. Every rule holds both
 * kinds; the distinction only says who counts as a reader of a production module's exports.
 */
export function isProduction(path: string): boolean {
  return (
    !/\.(test|spec)\.tsx?$/.test(path) && !/(^|\/)(test|tests|testing)\//.test(path) && !isTestInfrastructure(path)
  );
}

/** Every held TypeScript module but declaration files: what a repository scan covers. */
export function scannedFiles(): readonly string[] {
  return typescriptFiles().filter((path) => !path.endsWith('.d.ts'));
}

/** An open program and its checker over repository-relative paths. Close it when done. */
export interface Scan {
  readonly program: Program;
  readonly checker: Checker;
  readonly paths: readonly string[];
  readonly close: () => void;
}

let opened = 0;

/**
 * A scan over `paths`. `sources` ({path: text}) overlay the real files: a planted path need not exist
 * on disk, and a real path in `sources` reads as the overlay's text.
 */
export function openScan(paths: readonly string[], sources: Readonly<Record<string, string>> = {}): Scan {
  opened += 1;
  const config = join(REPO_ROOT, '.harness-scan', String(opened), 'tsconfig.json');
  const files = new Map(Object.entries(sources).map(([path, text]) => [join(REPO_ROOT, path), text]));
  files.set(config, JSON.stringify({ compilerOptions: OPTIONS, files: paths.map((path) => join(REPO_ROOT, path)) }));
  const unmount = mount(files);
  const project = api().updateSnapshot({ openProjects: [config] }).getProject(config);
  const close = (): void => {
    api().updateSnapshot({ closeProjects: [config] });
    unmount();
  };
  if (project === undefined) {
    close();
    throw new Error('the scan project did not open');
  }
  return { checker: project.checker, close, paths, program: project.program };
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
 * The qualified name of the declaration a symbol resolves to, through its parents: `Math.random`,
 * `DateConstructor.now`, `child_process.spawn`, `NodeJS.Process.env`. A module's quotes and `node:`
 * prefix are dropped, and so is Node's `__global` wrapper.
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
