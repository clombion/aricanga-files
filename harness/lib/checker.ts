/**
 * The one owner of the TypeScript program the harness's type-aware scans read.
 *
 * A scan asks what each name resolves to through TypeScript's own checker, so an alias, a
 * destructured binding or a property chain resolves to the declaration it stands for. The program
 * covers the held production modules (not the tests). A planted program holds in-memory sources at
 * paths under the repository root, so its imports, `lib` and `@types` resolve as the repository's do.
 */

import { join } from 'node:path';

import ts from 'typescript';

import { REPO_ROOT, relative } from './paths.ts';
import { typescriptFiles } from './scope.ts';
import { textOf } from './source-files.ts';

/** The options of the scan program: the shared base's strictness, every lib a held module reads. */
export const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  types: ['node', 'vite/client'],
  jsx: ts.JsxEmit.Preserve,
  jsxImportSource: '@solidjs/web',
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
  allowJs: false,
};

/** A held module that ships: TypeScript, not a Vitest test or a Playwright spec. */
export function isProduction(path: string): boolean {
  return /\.tsx?$/.test(path) && !/\.(test|spec)\.tsx?$/.test(path) && !path.endsWith('.d.ts');
}

/** The held production modules the repository program covers. */
export function productionFiles(): readonly string[] {
  return typescriptFiles().filter(isProduction);
}

/** A program and its checker, with the repository-relative paths it was asked to cover. */
export interface Scan {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly paths: readonly string[];
}

/** The source file of a covered path. */
export function sourceOf(scan: Scan, path: string): ts.SourceFile {
  const file = scan.program.getSourceFile(join(REPO_ROOT, path));
  if (file === undefined) {
    throw new Error(`the scan program does not cover ${path}`);
  }
  return file;
}

/** A program over `sources` ({path: text}, paths relative to the root), with the real files behind them. */
export function planted(sources: Readonly<Record<string, string>>): Scan {
  const virtual = new Map(Object.entries(sources).map(([path, text]) => [join(REPO_ROOT, path), text]));
  const host = ts.createCompilerHost(OPTIONS, true);
  const realFileExists = host.fileExists.bind(host);
  const realReadFile = host.readFile.bind(host);
  const realGetSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (name) => virtual.has(name) || realFileExists(name);
  host.readFile = (name) => virtual.get(name) ?? realReadFile(name);
  host.getSourceFile = (name, language, onError, create) => {
    const text = virtual.get(name);
    return text === undefined
      ? realGetSourceFile(name, language, onError, create)
      : ts.createSourceFile(name, text, language, true);
  };
  const program = ts.createProgram({ rootNames: [...virtual.keys()], options: OPTIONS, host });
  return { program, checker: program.getTypeChecker(), paths: Object.keys(sources) };
}

let repository: Scan | undefined;

/** The program over every held production module, built once per run. */
export function repositoryScan(): Scan {
  repository ??= planted(Object.fromEntries(productionFiles().map((path) => [path, textOf(path)])));
  return repository;
}

/** The repository-relative path of a source file. */
export function pathOf(file: ts.SourceFile): string {
  return relative(file.fileName);
}

/** Every node of a source file, depth first. */
export function nodes(file: ts.SourceFile): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** The symbol a name stands for, through import and export aliases. */
export function resolved(checker: ts.TypeChecker, symbol: ts.Symbol | undefined): ts.Symbol | undefined {
  if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

/**
 * The qualified name of a declaration a symbol resolves to: `Math.random`, `DateConstructor.now`,
 * `"child_process".spawn`. A symbol declared in several places (a global declared by both the DOM
 * and Node's types) has several names, one per declaration's container.
 */
export function qualifiedNames(checker: ts.TypeChecker, symbol: ts.Symbol | undefined): readonly string[] {
  const target = resolved(checker, symbol);
  if (target === undefined) {
    return [];
  }
  const names = new Set<string>([checker.getFullyQualifiedName(target)]);
  for (const declaration of target.declarations ?? []) {
    const parent = declaration.parent;
    const container =
      ts.isInterfaceDeclaration(parent) || ts.isClassDeclaration(parent) || ts.isModuleBlock(parent)
        ? parent
        : ts.isTypeLiteralNode(parent) && ts.isVariableDeclaration(parent.parent)
          ? parent.parent
          : undefined;
    const containerName =
      container !== undefined && 'name' in container && container.name !== undefined
        ? container.name.getText()
        : undefined;
    names.add(containerName === undefined ? target.name : `${containerName}.${target.name}`);
  }
  return [...names];
}

/** The text of a property name, or undefined for a computed one. */
export function propertyName(name: ts.PropertyName | ts.BindingName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isPrivateIdentifier(name)) {
    return name.text;
  }
  return undefined;
}
