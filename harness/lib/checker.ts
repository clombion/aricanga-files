/**
 * The harness's type-aware scans: programs whose checker says what each name resolves to.
 *
 * A scan opens a project on the one TypeScript 7 session of harness/lib/ts-session.ts, through a
 * virtual project file listing the paths it covers. An alias, a destructured binding or a property
 * chain resolves to the declaration it stands for. A planted scan mounts in-memory sources at paths
 * under the repository root, so their imports, `lib` and `@types` resolve exactly as the repository's
 * do. Every held module is scanned: tests, scripts and configs are held to the rules production
 * code is.
 */

import type { Checker, Program, Symbol as TsSymbol } from 'typescript/unstable/sync';
import type { Node, SourceFile } from 'typescript/unstable/ast';
import { REPO_ROOT, relative } from './paths.ts';
import { api, mount, nextName } from './ts-session.ts';
import { isIdentifier, isPrivateIdentifier, isStringLiteral } from 'typescript/unstable/ast';
import type { Population } from './scope.ts';
import { SymbolFlags } from 'typescript/unstable/sync';
import { isEmpty } from './lists.ts';
import { isRunnerTest } from './test-globs.ts';
import path from 'node:path';
import { present } from './present.ts';
import { ships } from './roles.ts';
import { typescriptOf } from './scope.ts';

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

/** Test support's directories: a member's `test/`, `tests/` and `testing/`. */
const TEST_DIRECTORY = /(?:^|\/)(?:test|tests|testing)\//u;
/** A symbol's flags with none set. */
const NO_FLAGS = 0;

const MODULE_NAME = /^"(?:node:)?(?<name>[^"]+)"$/u;

/** An open program and its checker over repository-relative paths. Close it when done. */
interface Scan {
  readonly program: Readonly<Program>;
  readonly checker: Readonly<Checker>;
  readonly paths: readonly string[];
  /** The population the scan reads roles from. */
  readonly population: Population;
  readonly close: () => void;
}

/** How a scan mounts its files, opens and releases its project, and the paths it covers. */
interface ScanOpening {
  readonly paths: readonly string[];
  readonly population: Population;
  readonly mount: () => () => void;
  readonly open: () => Readonly<{ checker: Readonly<Checker>; program: Readonly<Program> }> | undefined;
  readonly release: () => void;
}

/**
 * Whether a module belongs to a test infrastructure package: a member whose role does not ship.
 *
 * @param {Population} population - The population.
 * @param {string} file - A repository-relative path.
 * @returns {boolean} Whether its package exists only to test.
 */
function isTestInfrastructure(population: Population, file: string): boolean {
  const member = population.memberOf(file);
  return member !== undefined && !ships(member.role);
}

/**
 * A module that ships: not a module a test runner runs (`isRunnerTest`), test support under a
 * `test/`, `tests/` or `testing/` directory, or a module of a test infrastructure package. The
 * harness's check support (`harness/checks/`) is held as production is, so every check reads it. Whether coverage reads a module is the gate config's question,
 * not this one: a shipping member's `src/testing/` is test support and covered. Every rule holds both
 * kinds. The distinction decides who counts as a reader of a production module's exports
 * (`type-exports.ts`), which modules declare closed sets (`declared-sets.scan.ts`), and, among the
 * kernel members' modules, which declare contracts (`contracts.ts`).
 *
 * @param {Population} population - The population.
 * @param {string} file - A repository-relative path.
 * @returns {boolean} Whether the module ships.
 */
function isProduction(population: Population, file: string): boolean {
  return !isRunnerTest(file) && !TEST_DIRECTORY.test(file) && !isTestInfrastructure(population, file);
}

/**
 * Every TypeScript module a population holds but declaration files: what a scan over it covers.
 *
 * @param {Population} held - The population.
 * @returns {readonly string[]} The scanned modules.
 */
function scannedOf(held: Population): readonly string[] {
  return typescriptOf(held).filter((file) => !file.endsWith('.d.ts'));
}

/**
 * The files a scan mounts: its overlaid sources and its virtual project file.
 *
 * @param {string} config - The virtual project file's path.
 * @param {readonly string[]} paths - The covered paths.
 * @param {Readonly<Record<string, string>>} sources - The overlaid texts, by repository-relative path.
 * @returns {ReadonlyMap<string, string>} Each mounted file's text, by absolute path.
 */
function mounted(config: string, paths: readonly string[], sources: Readonly<Record<string, string>>): ReadonlyMap<string, string> {
  const project = JSON.stringify({ compilerOptions: OPTIONS, files: paths.map((file) => path.join(REPO_ROOT, file)) });
  return new Map([
    ...Object.entries(sources).map(([file, text]: readonly [string, string]) => [path.join(REPO_ROOT, file), text] as const),
    [config, project],
  ]);
}

/**
 * A scan over a mounted project. Every path that mounted the files and opened the project releases
 * both: the scan's `close` on success, and the refusal itself when the session has no such project.
 *
 * @param {ScanOpening} opening - How the scan mounts its files, opens and releases its project, and what it covers.
 * @returns {Scan} The open scan.
 */
function scanOver(opening: Readonly<ScanOpening>): Scan {
  const unmount = opening.mount();
  try {
    const project = present(opening.open(), 'the scan project');
    const close = (): void => {
      opening.release();
      unmount();
    };
    return { checker: project.checker, close, paths: opening.paths, population: opening.population, program: project.program };
  } catch (error) {
    opening.release();
    unmount();
    throw error;
  }
}

/**
 * A scan over a population: it covers the modules the population holds (`scannedOf`) and reads roles
 * from it, so its files and its population come from one listing. `sources` overlay the real files:
 * a planted path need not exist on disk, and a real path in `sources` reads as the overlay's text.
 *
 * @param {Population} population - The population the scan covers and reads roles from.
 * @param {Readonly<Record<string, string>>} sources - Overlaid texts, by repository-relative path.
 * @returns {Scan} The open scan.
 */
function openScan(population: Population, sources: Readonly<Record<string, string>>): Scan {
  const paths = scannedOf(population);
  const config = path.join(REPO_ROOT, '.harness-scan', nextName(), 'tsconfig.json');
  return scanOver({
    mount: () => mount(mounted(config, paths, sources)),
    open: () =>
      api()
        .updateSnapshot({ openProjects: [config] })
        .getProject(config),
    paths,
    population,
    release: () => {
      api().updateSnapshot({ closeProjects: [config] });
    },
  });
}

/**
 * The source file of a covered path.
 *
 * @param {Scan} scan - The open scan.
 * @param {string} file - A covered repository-relative path.
 * @returns {SourceFile} Its source file.
 */
function sourceOf(scan: Scan, file: string): SourceFile {
  const source = scan.program.getSourceFile(path.join(REPO_ROOT, file));
  if (source === undefined) {
    throw new Error(`the scan does not cover ${file}`);
  }
  return source;
}

/**
 * The repository-relative path of a source file.
 *
 * @param {SourceFile} file - The source file.
 * @returns {string} Its path.
 */
function pathOf(file: SourceFile): string {
  return relative(file.fileName);
}

/**
 * The source text of a node, without its leading trivia.
 *
 * @param {Node} node - The node.
 * @returns {string} Its text.
 */
function textOfNode(node: Node): string {
  const file = node.getSourceFile();
  return file.text.slice(node.getStart(file), node.getEnd());
}

/**
 * The symbol a name stands for, through import and export aliases.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {TsSymbol | undefined} symbol - The name's symbol.
 * @returns {TsSymbol | undefined} The symbol it resolves to.
 */
function resolved(checker: Readonly<Checker>, symbol: TsSymbol | undefined): TsSymbol | undefined {
  if (symbol !== undefined && (symbol.flags & SymbolFlags.Alias) !== NO_FLAGS) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

/**
 * The qualified name of the declaration a symbol resolves to, through its parents: `Math.random`,
 * `DateConstructor.now`, `child_process.spawn`, `NodeJS.Process.env`. A module's quotes and `node:`
 * prefix are dropped, and so is Node's `__global` wrapper.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {TsSymbol | undefined} symbol - The name's symbol.
 * @returns {string | undefined} The qualified name, or undefined.
 */
function qualifiedName(checker: Readonly<Checker>, symbol: TsSymbol | undefined): string | undefined {
  const names: string[] = [];
  for (let current = resolved(checker, symbol); current !== undefined; current = current.getParent()) {
    names.unshift(current.name.replace(MODULE_NAME, '$<name>'));
  }
  return isEmpty(names) ? undefined : names.filter((name) => name !== '__global').join('.');
}

/**
 * Whether a symbol is declared by the platform: a `lib` file or an installed package's types.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {TsSymbol | undefined} symbol - The name's symbol.
 * @returns {boolean} Whether every declaration of it is under `node_modules`.
 */
function isPlatform(checker: Readonly<Checker>, symbol: TsSymbol | undefined): boolean {
  const declarations = resolved(checker, symbol)?.declarations ?? [];
  return !isEmpty(declarations) && declarations.every((declaration) => declaration.path.includes('/node_modules/'));
}

/**
 * The text of a property or binding name.
 *
 * @param {Node | undefined} name - The name.
 * @returns {string | undefined} Its text, or undefined for a computed one.
 */
function nameText(name: Node | undefined): string | undefined {
  if (name !== undefined && (isIdentifier(name) || isStringLiteral(name) || isPrivateIdentifier(name))) {
    return name.text;
  }
  return undefined;
}

export { nodes } from './ts-source.ts';
export {
  isPlatform,
  isProduction,
  isTestInfrastructure,
  nameText,
  openScan,
  pathOf,
  qualifiedName,
  resolved,
  scanOver,
  sourceOf,
  textOfNode,
};
export type { Scan, ScanOpening };
