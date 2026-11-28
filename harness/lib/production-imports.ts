/**
 * The whole-chain half of the import boundaries (card C of audit js261125, the user's decision): a
 * production module imports no non-production module (`isProduction`), by any form, within its
 * member or across members, the harness's production modules included. By induction, nothing a
 * production module reaches through TypeScript modules is test support or test infrastructure; a file
 * the session declares by rule (a stylesheet, a file with no extension) is an empty module there, so
 * what it names in turn (a stylesheet's `@import`) is not read (verif-p5 P5-6, accepted by card A:
 * the verdict is the TypeScript project's file list).
 *
 * The verdict comes from the file list of a TypeScript project rooted at the production modules (T1,
 * the user's answer on card A of audit js261126): a held non-production file in it is the finding,
 * named from each production module whose own project reaches it, so every form TypeScript loads is
 * one case, however it is spelt (a relative path, a `#` alias, an exported `./testing` subpath). The
 * project lists every file a module can name (F1b2-C3): untyped JavaScript (`allowJs`, one level into
 * `node_modules`) and, while the session is `declaring`, each file TypeScript does not load itself (a
 * stylesheet, a file with no extension, held or installed); an installed file passes because it is
 * installed. In a production module the scan refuses what it cannot read (V3): an `import.meta` member
 * outside the admitted set (`chain-forms.ts`), a specifier with a query, an `import()` whose specifier is not a literal, a
 * specifier only a pattern declaration answers, and a specifier no file answers. A use the production
 * project cannot resolve but the scan's whole program answers only by test-support declarations is
 * reported as an import of each (the user's decisions FD1 and the R1 addition), under whatever
 * diagnostic the production project gives it; one it cannot resolve at all is refused. It rests on
 * `typescript/unstable/*`, and tracks it across 7.x.
 */

import { Accepted, Vocabulary } from '#lint-rules/exemptions.ts';
import type { Cause, Unread } from './chain-forms.ts';
import type { Checker, Diagnostic, Program } from 'typescript/unstable/sync';
import { NO_FILE, standsFor, unreadForm } from './chain-forms.ts';
import type { Node, SourceFile } from 'typescript/unstable/ast';
import { OPTIONS, isPlatformDeclaration, isProduction, nodes, resolved, scanOver, sourceOf } from './checker.ts';
import { REPO_ROOT, relative } from './paths.ts';
import { declaring, mountScan, nextName, snapshot } from './ts-session.ts';
import { isIdentifier, isNoSubstitutionTemplateLiteral, isStringLiteral } from 'typescript/unstable/ast';
import type { Scan } from './checker.ts';
import { isEmpty } from './lists.ts';
import path from 'node:path';
import { present } from './present.ts';

/** An import of a non-production module by a production one. */
interface Edge {
  readonly from: string;
  readonly to: string;
}

/** A production module's form the scan refuses where it stands, and why. */
interface Refusal {
  readonly from: string;
  readonly form: string;
  readonly cause: Cause;
}

/** What the whole chain finds: the imports it reports and the forms it refuses. */
interface Chain {
  readonly edges: readonly Edge[];
  readonly refused: readonly Refusal[];
}

/** A diagnostic of a production module, with the test-support files that alone answer its node, if any. */
interface Diagnosed {
  readonly diagnostic: Readonly<Diagnostic>;
  readonly owners: readonly string[];
}

/** A project of the whole chain, open until closed: its program, its checker, and the files it lists. */
interface ChainProject {
  readonly program: Readonly<Program>;
  readonly checker: Readonly<Checker>;
  readonly files: readonly string[];
  readonly close: () => void;
}

/** TypeScript's diagnostic of a name nothing declares. */
const NO_NAME = 2304;

/** TypeScript's diagnostic of a module specifier nothing answers. */
const NO_MODULE = 2307;

/** TypeScript's diagnostic of a member its object's type lacks. */
const NO_MEMBER = 2339;

/** TypeScript's diagnostic of a side-effect import nothing answers (`noUncheckedSideEffectImports`). */
const NO_SIDE_EFFECT_MODULE = 2882;

/**
 * The diagnostics of a use the production project cannot resolve: a name, a module, a member, a
 * side-effect import of nothing. Not answered by test support either, such a use is refused; any
 * other diagnostic is the type check's.
 */
const UNRESOLVED: Accepted<number> = new Accepted<number>([NO_NAME, NO_MODULE, NO_MEMBER, NO_SIDE_EFFECT_MODULE]);

/** The diagnostics of a specifier no file answers: a module, a side-effect import. */
const UNANSWERED_SPECIFIER: Accepted<number> = new Accepted<number>([NO_MODULE, NO_SIDE_EFFECT_MODULE]);

/**
 * What the report says of a refusal, by its cause: why the chain refuses the form, and what to do
 * about it. A form the chain cannot read is respelt or moved out of production; a specifier or a
 * use no file answers names what a file or an installed package declares, or goes.
 */
const TOLD: Vocabulary<Readonly<Record<Cause, string>>> = new Vocabulary<Readonly<Record<Cause, string>>>({
  unanswered: 'no file the production project lists answers it, so name what a file or an installed package declares, or remove it',
  unread:
    'the whole chain cannot read it in a production module, so respell it as a form the chain reads, or move it into a non-production module',
});

/** The compiler options of the whole chain's projects: a scan's, listing every file a module can name. */
const CHAIN_OPTIONS = {
  ...OPTIONS,
  allowArbitraryExtensions: true,
  allowJs: true,
  maxNodeModuleJsDepth: 1,
  noUncheckedSideEffectImports: true,
} as const;

/** The size of an empty set. */
const NONE = 0;

/**
 * Open a project of the whole chain over `roots`, as a scan opens its project (`scanOver`).
 *
 * @param {Scan} scan - The open scan, whose population the project reads.
 * @param {ReadonlySet<string>} listed - The population's listed files.
 * @param {readonly string[]} roots - The production modules it is rooted at.
 * @returns {ChainProject} The open project.
 */
function openChain(scan: Scan, listed: ReadonlySet<string>, roots: readonly string[]): ChainProject {
  const config = path.join(REPO_ROOT, '.harness-scan', nextName(), 'tsconfig.json');
  const text = JSON.stringify({ compilerOptions: CHAIN_OPTIONS, files: roots.map((file) => path.join(REPO_ROOT, file)) });
  const opened = scanOver({
    mount: () => mountScan(new Map([[config, text]])),
    open: () => snapshot({ openProjects: [config] }).getProject(config),
    paths: roots,
    population: scan.population,
    release: () => {
      snapshot({ closeProjects: [config] });
    },
  });
  const files = opened.program
    .getSourceFileNames()
    .filter((name) => !isPlatformDeclaration(name))
    .map((name) => standsFor(listed, relative(name)));
  return { checker: opened.checker, close: opened.close, files, program: opened.program };
}

/**
 * The name, string or private name a diagnostic stands on in a module of the scan.
 *
 * @param {SourceFile} file - The module, in the scan's program.
 * @param {Diagnostic} diagnostic - A diagnostic of the module in the production project.
 * @returns {Node | undefined} The node, or none.
 */
function nodeAt(file: SourceFile, diagnostic: Readonly<Diagnostic>): Node | undefined {
  return nodes(file).find(
    (node) =>
      node.end === diagnostic.end &&
      node.getStart(file) === diagnostic.pos &&
      (isIdentifier(node) || isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)),
  );
}

/**
 * The held non-production files that alone declare what a node of a production module names, in the
 * scan's whole program: each test-support declaration answering it, or none when another answers it.
 *
 * @param {Scan} scan - The open scan.
 * @param {string} from - The production module.
 * @param {Diagnostic} diagnostic - A diagnostic of it in the production project.
 * @returns {readonly string[]} The declaring files, or none.
 */
function answeredByTestSupport(scan: Scan, from: string, diagnostic: Readonly<Diagnostic>): readonly string[] {
  const node = nodeAt(sourceOf(scan, from), diagnostic);
  const symbol = node === undefined ? undefined : resolved(scan.checker, scan.checker.getSymbolAtLocation(node));
  const owners = [...new Set((symbol?.declarations ?? []).map((declaration) => relative(declaration.path)))];
  const held = scan.population;
  return !isEmpty(owners) && owners.every((owner) => held.holds(owner) && !isProduction(held, owner)) ? owners : [];
}

/**
 * Edges in order, each once: by importer, then by imported file.
 *
 * @param {readonly Edge[]} edges - The edges.
 * @returns {readonly Edge[]} Each edge once, sorted.
 */
function distinct(edges: readonly Edge[]): readonly Edge[] {
  const keyed = new Map(edges.map((edge) => [`${edge.from}\u0000${edge.to}`, edge] as const));
  return [...keyed.keys()].toSorted().map((key) => present(keyed.get(key), 'an edge'));
}

/**
 * The refusal of a use nothing answers: a specifier no file answers, by the four ways none does, or a use
 * the production project cannot resolve.
 *
 * @param {Readonly<Diagnostic>} diagnostic - Its diagnostic in the production project.
 * @returns {Unread} The refused form, unanswered.
 */
function unresolvedForm(diagnostic: Readonly<Diagnostic>): Unread {
  return {
    cause: 'unanswered',
    form: UNANSWERED_SPECIFIER.has(diagnostic.code)
      ? `${NO_FILE}: ${diagnostic.text}`
      : `a use the production project cannot resolve (TS${diagnostic.code}): ${diagnostic.text}`,
  };
}

/**
 * The findings of one production module in the production project: the forms it cannot read, the uses
 * test support alone answers (edges), and the uses nothing answers.
 *
 * @param {Scan} scan - The open scan.
 * @param {ChainProject} whole - The production project.
 * @param {string} from - The production module.
 * @returns {Chain} Its edges and refusals.
 */
function moduleFindings(scan: Scan, whole: ChainProject, from: string): Chain {
  const name = path.join(REPO_ROOT, from);
  const file = present(whole.program.getSourceFile(name), `the production project's ${from}`);
  const forms = nodes(file).flatMap((node) => unreadForm(node, whole.checker) ?? []);
  const diagnosed = whole.program
    .getSemanticDiagnostics(name)
    .map((diagnostic: Readonly<Diagnostic>): Diagnosed => ({ diagnostic, owners: answeredByTestSupport(scan, from, diagnostic) }));
  const unresolved = diagnosed.filter((found: Diagnosed) => isEmpty(found.owners) && UNRESOLVED.has(found.diagnostic.code));
  return {
    edges: diagnosed.flatMap((found: Diagnosed) => found.owners.map((to) => ({ from, to }))),
    refused: [...forms, ...unresolved.map((found: Diagnosed) => unresolvedForm(found.diagnostic))].map(({ cause, form }) => ({
      cause,
      form,
      from,
    })),
  };
}

/**
 * The whole chain over a scan: the held non-production files the production project lists, each named
 * from every production module whose own project reaches it, the uses test support alone answers, and
 * the forms the scan cannot read, refused. A production module's own project opens only when the
 * production project lists such a file, so a passing run opens one project.
 *
 * @param {Scan} scan - The open scan, whose population and overlaid texts it reads.
 * @returns {Chain} The edges, by importer then imported file, and the refusals, by module.
 */
function wholeChain(scan: Scan): Chain {
  const held = scan.population;
  const production = scan.paths.filter((from) => isProduction(held, from));
  const listed = new Set(held.listing);
  return scan.serving(() =>
    declaring(() => {
      const whole = openChain(scan, listed, production);
      try {
        const reached = new Set(whole.files.filter((file) => held.holds(file) && !isProduction(held, file)));
        const found = production.map((from) => moduleFindings(scan, whole, from));
        const reaching =
          reached.size === NONE
            ? []
            : production.flatMap((from) => {
                const own = openChain(scan, listed, [from]);
                try {
                  return own.files.filter((to) => reached.has(to)).map((to) => ({ from, to }));
                } finally {
                  own.close();
                }
              });
        return {
          edges: distinct([...reaching, ...found.flatMap((chain) => chain.edges)]),
          refused: found.flatMap((chain) => chain.refused),
        };
      } finally {
        whole.close();
      }
    }),
  );
}

/**
 * What the whole chain tells its reader: each finding on one line, naming its files, why it is
 * refused and what to do, as its cause words them.
 *
 * @param {Chain} found - What the chain finds.
 * @returns {readonly string[]} One line per edge, then one per refusal.
 */
function chainReport(found: Chain): readonly string[] {
  return [
    ...found.edges.map(
      (edge) =>
        `${edge.from} reaches ${edge.to}, a non-production module, by an import or a name only its declarations answer: a production module reaches no test support or test infrastructure, so move what it uses into a production module, or use it from a non-production one`,
    ),
    ...found.refused.map((refusal) => `${refusal.from} is refused (${refusal.form}): ${TOLD.of(refusal.cause)}`),
  ];
}

export { chainReport, wholeChain };
export type { Chain };
