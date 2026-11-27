/**
 * Every reference in current text resolves: links and anchors, backticked paths, tasks, ADRs and commands.
 *
 * Over the current text of `harness/lib/docs.ts`:
 *
 * - a relative Markdown link names a listed file or directory, and its anchor a heading of that file;
 * - a backticked path (a span with a `/` or a known file suffix) names a listed file or
 *   directory, from the root or from the doc's own folder, or is the tail of one (`systems/chat`);
 *   a bare file name names a listed file's name; a path under `node_modules/` names an installed
 *   file and a package span (`@solidjs/web`) an installed or workspace package;
 * - `pnpm run <task>` names a script of the root `package.json`;
 * - a span with no file suffix that is no listed path resolves as a named value (a lint rule id, an
 *   effect kind) when held code or config outside the checks quotes it as a string, or is the id of
 *   a rule the locked oxlint knows (`node/no-process-env`);
 * - `ADR-NNNN` names a decision record under `docs/roadmap/decisions/`;
 * - in a shell fence, a locked tool runs through `pnpm exec` or `pnpm run`, never bare and never
 *   through an unlocked runner.
 *
 * A span holding `<`, `{`, `*`, `...` or a space is a placeholder or a pattern and is not resolved.
 */

import { Accepted, Exemptions, site } from '#lint-rules/exemptions.ts';
import { Doc, currentSpans, currentText, markdownDocs } from '#lib/docs.ts';
import { adrProblems, fenceProblems, key, linkProblems, spanProblems } from './doc-references.resolve.ts';
import { describe, expect, test } from 'vitest';
import { installedPaths, oxlintRuleIds, quotedValues } from './doc-references.installed.ts';
import { PopulationError } from '#lib/workspace.ts';
import type { Resolver } from './doc-references.resolve.ts';
import { packagesNamed } from './doc-references.packages.ts';
import { repoTasks } from '#lib/repo-tasks.ts';
import { tracked } from '#lib/source-files.ts';

const HARNESS_ID = 'doc-references';

/** Links that are right though they do not resolve, keyed by `site(path, target)`. */
const LINKS_EXEMPT = Exemptions.grouped({});

/** Backticked paths and tasks that are right though they do not resolve, keyed by `site(path, span)`. */
const SPANS_EXEMPT = Exemptions.grouped({
  'systems/phone is created by the phone-chrome issue (#34); the entry goes when it exists': [
    site('docs/roadmap/phase-3-view-layer.md', 'systems/phone'),
  ],
});

/** ADR numbers named before their record exists, keyed by `site(path, ADR-NNNN)`. */
const ADRS_EXEMPT = Exemptions.grouped({});

/**
 * What the repository's spans resolve against, the installed paths read from disk once.
 *
 * @returns {Promise<Resolver>} The resolver.
 */
async function repoResolver(): Promise<Resolver> {
  const [quoted, rules, files, tasks, spans] = await Promise.all([quotedValues(), oxlintRuleIds(), tracked(), repoTasks(), currentSpans()]);
  const named = (value: string): boolean => quoted.has(value) || rules.has(value);
  const base = { files, named, taskNames: new Set(tasks.keys()) };
  const installed = await installedPaths(spans, base);
  return { ...base, installed: (path) => installed.has(path) };
}

describe('the repository', () => {
  test('every link resolves', async () => {
    expect.hasAssertions();
    const [files, parsed] = await Promise.all([tracked(), markdownDocs()]);
    const docs = new Map(parsed.map((doc) => [doc.path, doc] as const));
    const found = [...docs.values()].flatMap((doc) => doc.links().flatMap((link) => linkProblems(link, files, docs)));
    expect(LINKS_EXEMPT.unexemptedBy(found, key)).toStrictEqual([]);
  });

  test('every backticked path and task resolves', async () => {
    expect.hasAssertions();
    const resolver = await repoResolver();
    const spans = await currentSpans();
    const found = spans.flatMap((span) => spanProblems(span, resolver));
    expect(SPANS_EXEMPT.unexemptedBy(found, key)).toStrictEqual([]);
  });

  test('every ADR named has its record', async () => {
    expect.hasAssertions();
    const [files, lines] = await Promise.all([tracked(), currentText()]);
    const found = lines.flatMap((line) => adrProblems(line, files));
    expect(ADRS_EXEMPT.unexemptedBy(found, key)).toStrictEqual([]);
  });

  test('every locked tool in a shell fence runs through pnpm', async () => {
    expect.hasAssertions();
    const docs = await markdownDocs();
    const found = docs.flatMap((doc) => fenceProblems(doc));
    expect(found).toStrictEqual([]);
  });
});

const PLANTED_DOC = `# Planted

## A section

See [the section](#a-section), [the other file](other.md#its-heading), [a folder](sub/) and [the web](https://example.com).
See [nothing](missing.md), [no anchor](#nowhere) and [a bad anchor](other.md#nowhere).
`;

describe('the link check', () => {
  test('sees each planted link and lets the resolving ones through', () => {
    expect.hasAssertions();
    const docs = new Map([
      ['docs/planted.md', new Doc('docs/planted.md', PLANTED_DOC)],
      ['docs/other.md', new Doc('docs/other.md', '## Its heading\n')],
    ]);
    const files = ['docs/planted.md', 'docs/other.md', 'docs/sub/a.ts'];
    const found = docs
      .get('docs/planted.md')
      ?.links()
      .flatMap((link) => linkProblems(link, files, docs))
      .map((problem) => problem.reference);
    expect(found).toStrictEqual(['missing.md', '#nowhere', 'other.md#nowhere']);
  });
});

/** The installed paths of the planted span checks. */
const PLANTED_INSTALLED = new Accepted([
  'node_modules',
  'node_modules/solid-js/skills',
  'node_modules/@solidjs/web',
  'node_modules/typescript',
]);
/** The values quoted in the planted span checks' code. */
const PLANTED_NAMED = new Accepted(['chat/showNotification', 'aricanga/autofocus']);

const PLANTED_RESOLVER: Resolver = {
  files: ['src/a.ts', 'docs/planted.md', 'docs/other.md', 'packages/systems/chat/src/model/route.ts'],
  installed: (path) => PLANTED_INSTALLED.has(path),
  named: (value) => PLANTED_NAMED.has(value),
  taskNames: new Set(['check']),
};

describe('the span check', () => {
  test.each([
    ['src/missing.ts', 'the path is not listed'],
    ['missing.toml', 'the path is not listed'],
    ['node_modules/nothing/here', 'the path is not installed'],
    ['@nothing/here', 'the package is not installed'],
    ['systems/phone', 'the path is not listed'],
    ['../missing.md', 'the path is not listed'],
    ['pnpm run no-such-task', 'no task is named "no-such-task"'],
    ['chat/noSuchEffect', 'the path is not listed'],
    ['missing/rule.ts', 'the path is not listed'],
  ])('sees the planted span %s', (text, problem) => {
    expect.hasAssertions();
    const found = spanProblems({ line: 1, path: 'docs/planted.md', text }, PLANTED_RESOLVER);
    expect(found.map((unresolved) => unresolved.problem)).toStrictEqual([problem]);
  });

  test.each([
    'src/a.ts',
    'src',
    'src/',
    'a.ts',
    '/',
    'src/<pkg>/x.ts',
    'harness/**',
    'pnpm run check',
    'node_modules/solid-js/skills/',
    'node_modules/',
    '@solidjs/web',
    '@solidjs/web/dist/server',
    'model/route.ts',
    'chat/src',
    'other.md',
    './other.md',
    'example.org',
    '-k 50',
    'https://example.com/a.ts',
    'lint/...',
    'typescript/unstable/ast',
    'chat/showNotification',
    'aricanga/autofocus',
  ])('lets the resolving span or placeholder %s through', (text) => {
    expect.hasAssertions();
    expect(spanProblems({ line: 1, path: 'docs/planted.md', text }, PLANTED_RESOLVER)).toStrictEqual([]);
  });
});

describe('the ADR check', () => {
  test('sees an ADR with no record and lets a recorded one through', () => {
    expect.hasAssertions();
    const files = ['docs/roadmap/decisions/0007-system-io-algebra.md'];
    const line = { line: 1, path: 'docs/planted.md', text: 'See ADR-0007 and ADR-0042.' };
    expect(adrProblems(line, files).map((problem) => problem.reference)).toStrictEqual(['ADR-0042']);
  });

  test('passes an exempted reference and fails a stale exemption', () => {
    expect.hasAssertions();
    const planted = { line: 1, path: 'docs/planted.md', problem: 'no decision record has this number', reference: 'ADR-0042' };
    const exempt = new Exemptions({ [site('docs/planted.md', 'ADR-0042')]: 'planted: written next' });
    expect(exempt.unexemptedBy([planted], key)).toStrictEqual([]);
    expect(() => exempt.unexemptedBy([], key)).toThrow(/stale/u);
  });
});

describe('the fence check', () => {
  test('sees each bare or unlocked tool and lets pnpm and other fences through', () => {
    expect.hasAssertions();
    const doc = new Doc(
      'docs/planted.md',
      '```sh\noxlint\n$ vitest run\nnpx knip\npnpm dlx jscpd\npnpm exec oxlint\npnpm run check\ngit status\n```\n\n```ts\nconst tsc = 1;\n```\n',
    );
    expect(fenceProblems(doc).map((problem) => problem.reference)).toStrictEqual(['oxlint', '$ vitest run', 'npx knip', 'pnpm dlx jscpd']);
  });
});

describe('the packages a reference may name', () => {
  test("read each manifest's name by the population's one rule, refusing a name that is no string as the population does", () => {
    expect.hasAssertions();
    expect(
      packagesNamed([
        ['packages/a/package.json', '{"name":"@p/a"}'],
        ['packages/b/package.json', '{}'],
      ]),
    ).toStrictEqual([['@p/a', 'packages/a']]);
    expect(() => packagesNamed([['packages/c/package.json', '{"name":7}']])).toThrow(
      new PopulationError('name', "packages/c/package.json: the name 7 is no string: a package's name is a string, or none"),
    );
  });
});

export { HARNESS_ID };
