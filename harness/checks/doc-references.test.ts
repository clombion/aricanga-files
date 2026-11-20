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
 * - `ADR-NNNN` names a decision record under `docs/roadmap/decisions/`;
 * - in a shell fence, a locked tool runs through `pnpm exec` or `pnpm run`, never bare and never
 *   through an unlocked runner.
 *
 * A span holding `<`, `{`, `*` or a space is a placeholder or a pattern and is not resolved.
 */

import { existsSync } from 'node:fs';
import { posix } from 'node:path';

import { describe, expect, test } from 'vitest';

import { json, object, repoTasks } from '../lib/config.ts';
import { currentSpans, currentText, Doc, type Link, markdown, markdownPaths, type Prose, type Span } from '../lib/docs.ts';
import { Accepted, Exemptions, site } from '../lib/exemptions.ts';
import { fromRoot } from '../lib/paths.ts';
import { heldFiles } from '../lib/scope.ts';
import { textOf, tracked } from '../lib/source-files.ts';

export const HARNESS_ID = 'doc-references';

const SUFFIXES = new Accepted([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.md',
  '.json',
  '.toml',
  '.yaml',
  '.yml',
  '.lock',
  '.css',
  '.html',
  '.ink',
  '.sh',
  '.txt',
]);
const SHELL_FENCES = new Accepted(['sh', 'bash', 'shell', 'console', 'zsh']);
/** The locked tools a shell fence must run through `pnpm exec` or `pnpm run`. */
const LOCKED_TOOLS = new Accepted([
  'oxlint',
  'oxfmt',
  'biome',
  'tsc',
  'vitest',
  'playwright',
  'knip',
  'jscpd',
  'stylelint',
  'lefthook',
  'commitlint',
  'vite',
]);
const UNLOCKED_RUNNERS = new Accepted(['npx', 'pnpx', 'bunx', 'dlx']);
const DECISIONS = 'docs/roadmap/decisions/';
const ADR = /\bADR-(\d{4})\b/g;
const PNPM_RUN = /\bpnpm run ([\w:.-]+)/g;
/** A scoped package specifier, with or without a subpath (`@solidjs/web`). */
const PACKAGE = /^(@[\w.-]+\/[\w.-]+)(?:\/.*)?$/;

/** Links that are right though they do not resolve, keyed by `site(path, target)`. */
const LINKS_EXEMPT = Exemptions.grouped({});

/** Backticked paths and tasks that are right though they do not resolve, keyed by `site(path, span)`. */
const SPANS_EXEMPT = Exemptions.grouped({
  'HARNESS_STATUS.md is written with the harness-status check; the entries go when it exists': [
    site('docs/roadmap/decisions/0006-test-first-and-correctness-harness.md', 'HARNESS_STATUS.md'),
    site('harness.md', 'HARNESS_STATUS.md'),
  ],
  'systems/phone is created by the phone-chrome issue (#34); the entry goes when it exists': [
    site('docs/roadmap/phase-3-view-layer.md', 'systems/phone'),
  ],
});

/** ADR numbers named before their record exists, keyed by `site(path, ADR-NNNN)`. */
const ADRS_EXEMPT = Exemptions.grouped({
  'ADR-0009 (the Solid runtime model) is written from the characterisation results; the entries go when it exists':
    [
      site('docs/roadmap/decisions/0002-typescript-and-solid.md', 'ADR-0009'),
      site('docs/roadmap/phase-3-view-layer.md', 'ADR-0009'),
      site('packages/characterisation/src/harness.ts', 'ADR-0009'),
    ],
});

/** A reference that names nothing. */
export interface Unresolved {
  readonly path: string;
  readonly line: number;
  readonly reference: string;
  readonly problem: string;
}

function key(found: Unresolved): string {
  return site(found.path, found.reference);
}

function directories(files: readonly string[]): ReadonlySet<string> {
  const found = new Set<string>();
  for (const file of files) {
    let parent = posix.dirname(file);
    while (parent !== '.' && !found.has(parent)) {
      found.add(parent);
      parent = posix.dirname(parent);
    }
  }
  return found;
}

/** A relative link whose file or anchor is missing. */
export function linkProblems(link: Link, files: readonly string[], docs: ReadonlyMap<string, Doc>): Unresolved[] {
  if (/^[a-z]+:/.test(link.target)) {
    return [];
  }
  const [target = '', fragment = ''] = link.target.split('#', 2);
  const resolved = target === '' ? link.path : posix.normalize(posix.join(posix.dirname(link.path), decodeURI(target)));
  const dirs = directories(files);
  if (!files.includes(resolved) && !dirs.has(resolved.replace(/\/$/, ''))) {
    return [{ path: link.path, line: link.line, reference: link.target, problem: 'the linked file is not listed' }];
  }
  if (fragment !== '' && !(docs.get(resolved)?.anchors().has(fragment) ?? false)) {
    return [
      { path: link.path, line: link.line, reference: link.target, problem: 'the anchor is not a heading of the linked file' },
    ];
  }
  return [];
}

function looksLikePath(text: string): boolean {
  if (
    text.replaceAll('/', '') === '' ||
    /[<{* ]/.test(text) ||
    text.includes('...') ||
    text.includes('…') ||
    text.startsWith('-') ||
    /^[a-z]+:/.test(text)
  ) {
    return false;
  }
  return text.includes('/') || SUFFIXES.has(posix.extname(text));
}

/** Whether `path` names a listed file or directory, or is the tail of one. */
function listed(path: string, files: readonly string[]): boolean {
  if (files.includes(path) || directories(files).has(path)) {
    return true;
  }
  const tail = `/${path}`;
  return path.includes('/')
    ? files.some((file) => file.endsWith(tail)) || [...directories(files)].some((dir) => dir.endsWith(tail))
    : files.some((file) => posix.basename(file) === path) ||
        [...directories(files)].some((dir) => posix.basename(dir) === path);
}

/** What a span resolves against. */
export interface Resolver {
  /** The listed files. */
  readonly files: readonly string[];
  /** The root script names. */
  readonly taskNames: ReadonlySet<string>;
  /** Whether a `node_modules/` path is installed. */
  readonly installed: (path: string) => boolean;
  /** Whether a value is quoted as a string in held code or config: a rule id, an effect kind. */
  readonly named: (value: string) => boolean;
}

/** A backticked path, package, named value or task that resolves to nothing. */
export function spanProblems(span: Span, resolver: Resolver): Unresolved[] {
  const { files, taskNames, installed, named } = resolver;
  const text = span.text;
  const unresolved = (problem: string): Unresolved[] => [{ path: span.path, line: span.line, reference: text, problem }];
  for (const match of text.matchAll(PNPM_RUN)) {
    const task = match[1] ?? '';
    if (!taskNames.has(task)) {
      return unresolved(`no task is named ${JSON.stringify(task)}`);
    }
  }
  if (!looksLikePath(text)) {
    return [];
  }
  if (PACKAGE.test(text)) {
    const name = PACKAGE.exec(text)?.[1] ?? '';
    return installed(`node_modules/${name}`) ? [] : unresolved('the package is not installed');
  }
  const path = text.replace(/\/$/, '');
  if (path === 'node_modules' || path.startsWith('node_modules/')) {
    return installed(path) ? [] : unresolved('the path is not installed');
  }
  const fromDoc = posix.normalize(posix.join(posix.dirname(span.path), path));
  if (listed(path, files) || files.includes(fromDoc) || directories(files).has(fromDoc)) {
    return [];
  }
  const [first = ''] = path.split('/');
  if (path.includes('/') && installed(`node_modules/${first}`)) {
    return [];
  }
  return posix.extname(path) === '' && named(text) ? [] : unresolved('the path is not listed');
}

/** An `ADR-NNNN` that names no decision record. */
export function adrProblems(line: Prose, files: readonly string[]): Unresolved[] {
  return [...line.text.matchAll(ADR)]
    .filter((match) => !files.some((file) => file.startsWith(`${DECISIONS}${match[1] ?? ''}-`)))
    .map((match) => ({ path: line.path, line: line.line, reference: match[0], problem: 'no decision record has this number' }));
}

/** A locked tool in a shell fence run bare or through an unlocked runner. */
export function fenceProblems(doc: Doc): Unresolved[] {
  return doc
    .fences()
    .filter((fence) => SHELL_FENCES.has(fence.info.split(' ', 1)[0] ?? ''))
    .flatMap((fence) =>
      fence.lines.flatMap((line, offset) => {
        const words = line.trim().replace(/^\$ /, '').split(/\s+/);
        const bare = LOCKED_TOOLS.has(words[0] ?? '');
        const unlocked = UNLOCKED_RUNNERS.has(words[0] ?? '') || (words[0] === 'pnpm' && words[1] === 'dlx');
        return bare || unlocked
          ? [{ path: doc.path, line: fence.line + offset + 1, reference: line.trim(), problem: 'a locked tool runs through pnpm' }]
          : [];
      }),
    );
}

/** The listed workspace packages: their names and folders. */
function workspaces(): readonly (readonly [string, string])[] {
  return tracked()
    .filter((path) => path.endsWith('package.json') && !path.includes('node_modules/'))
    .flatMap((path) => {
      const name = object(json(textOf(path)), path).name;
      return typeof name === 'string' ? [[name, posix.dirname(path)] as const] : [];
    });
}

/**
 * Whether a `node_modules/` path is installed: at the root, or, for a package, under any workspace
 * package's own `node_modules` (pnpm links a dependency only where it is declared), or as a
 * workspace package itself.
 */
function installedOnDisk(path: string): boolean {
  if (existsSync(fromRoot(path))) {
    return true;
  }
  const inner = path.replace(/^node_modules\//, '');
  const known = workspaces();
  return (
    known.some(([name]) => inner === name || inner.startsWith(`${name}/`)) ||
    known.some(([, folder]) => existsSync(fromRoot(folder, 'node_modules', inner)))
  );
}

const QUOTED = /['"]([^'"\n]+)['"]/g;

/** Every string value quoted in held TypeScript, JavaScript and JSON. */
function quotedValues(): ReadonlySet<string> {
  return new Set(
    heldFiles('.ts', '.tsx', '.js', '.mjs', '.json').flatMap((path) =>
      [...textOf(path).matchAll(QUOTED)].map((match) => match[1] ?? ''),
    ),
  );
}

function repoTaskNames(): ReadonlySet<string> {
  return new Set(repoTasks().keys());
}

describe('the repository', () => {
  test('every link resolves', () => {
    const files = tracked();
    const docs = new Map(markdownPaths().map((path) => [path, markdown(path)] as const));
    const found = [...docs.values()].flatMap((doc) => doc.links().flatMap((link) => linkProblems(link, files, docs)));
    expect(LINKS_EXEMPT.unexemptedBy(found, key)).toEqual([]);
  });

  test('every backticked path and task resolves', () => {
    const files = tracked();
    const names = repoTaskNames();
    const quoted = quotedValues();
    const resolver: Resolver = { files, taskNames: names, installed: installedOnDisk, named: (value) => quoted.has(value) };
    const found = currentSpans().flatMap((span) => spanProblems(span, resolver));
    expect(SPANS_EXEMPT.unexemptedBy(found, key)).toEqual([]);
  });

  test('every ADR named has its record', () => {
    const files = tracked();
    expect(ADRS_EXEMPT.unexemptedBy(currentText().flatMap((line) => adrProblems(line, files)), key)).toEqual([]);
  });

  test('every locked tool in a shell fence runs through pnpm', () => {
    expect(markdownPaths().flatMap((path) => fenceProblems(markdown(path)))).toEqual([]);
  });
});

const PLANTED_DOC = `# Planted

## A section

See [the section](#a-section), [the other file](other.md#its-heading), [a folder](sub/) and [the web](https://example.com).
See [nothing](missing.md), [no anchor](#nowhere) and [a bad anchor](other.md#nowhere).
`;

describe('the link check', () => {
  test('sees each planted link and lets the resolving ones through', () => {
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
    expect(found).toEqual(['missing.md', '#nowhere', 'other.md#nowhere']);
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
  taskNames: new Set(['check']),
  installed: (path) => PLANTED_INSTALLED.has(path),
  named: (value) => PLANTED_NAMED.has(value),
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
    const found = spanProblems({ path: 'docs/planted.md', line: 1, text }, PLANTED_RESOLVER);
    expect(found.map((unresolved) => unresolved.problem)).toEqual([problem]);
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
    expect(spanProblems({ path: 'docs/planted.md', line: 1, text }, PLANTED_RESOLVER)).toEqual([]);
  });
});

describe('the ADR check', () => {
  test('sees an ADR with no record and lets a recorded one through', () => {
    const files = ['docs/roadmap/decisions/0007-system-io-algebra.md'];
    const line = { path: 'docs/planted.md', line: 1, text: 'See ADR-0007 and ADR-0042.' };
    expect(adrProblems(line, files).map((problem) => problem.reference)).toEqual(['ADR-0042']);
  });

  test('passes an exempted reference and fails a stale exemption', () => {
    const planted = { path: 'docs/planted.md', line: 1, reference: 'ADR-0042', problem: 'no decision record has this number' };
    const exempt = new Exemptions({ [site('docs/planted.md', 'ADR-0042')]: 'planted: written next' });
    expect(exempt.unexemptedBy([planted], key)).toEqual([]);
    expect(() => exempt.unexemptedBy([], key)).toThrow(/stale/);
  });
});

describe('the fence check', () => {
  test('sees each bare or unlocked tool and lets pnpm and other fences through', () => {
    const doc = new Doc(
      'docs/planted.md',
      '```sh\noxlint\n$ vitest run\nnpx knip\npnpm dlx jscpd\npnpm exec oxlint\npnpm run check\ngit status\n```\n\n```ts\nconst tsc = 1;\n```\n',
    );
    expect(fenceProblems(doc).map((problem) => problem.reference)).toEqual([
      'oxlint',
      '$ vitest run',
      'npx knip',
      'pnpm dlx jscpd',
    ]);
  });
});
