/**
 * What the `doc-references` check resolves a reference against, and the problems of each kind of
 * reference: links and anchors, backticked paths, packages, named values and tasks, ADRs, and the
 * locked tools of a shell fence.
 */

import { Accepted, site } from '#lint-rules/exemptions.ts';
import type { Doc, Link, Prose, Span } from '#lib/docs.ts';
import { basename, dirname, extname, join, normalize } from 'node:path/posix';
import { TYPESCRIPT } from '#lib/source-files.ts';

const SUFFIXES = new Accepted([
  ...TYPESCRIPT,
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
const ADR = /\bADR-(?<number>\d{4})\b/gu;
const PNPM_RUN = /\bpnpm run (?<task>[\w:.-]+)/gu;
/** A scoped package specifier, with or without a subpath (`@solidjs/web`). */
const PACKAGE = /^(?<name>@[\w.-]+\/[\w.-]+)(?:\/.*)?$/u;
const SCHEME = /^[a-z]+:/u;
const PLACEHOLDER = /[<{* ]/u;
/** The offset from a fence's opening line to its first content line. */
const FIRST_LINE_OFFSET = 1;

/** A reference that names nothing. */
interface Unresolved {
  readonly path: string;
  readonly line: number;
  readonly reference: string;
  readonly problem: string;
}

/** What a span resolves against. */
interface Resolver {
  /** The listed files. */
  readonly files: readonly string[];
  /** The root script names. */
  readonly taskNames: ReadonlySet<string>;
  /** Whether a `node_modules/` path is installed. */
  readonly installed: (path: string) => boolean;
  /** Whether a value is quoted as a string in held code or config: a rule id, an effect kind. */
  readonly named: (value: string) => boolean;
}

/**
 * A finding's exemption key.
 *
 * @param {Unresolved} found - A reference that names nothing.
 * @returns {string} Its `site(path, reference)` key.
 */
function key(found: Unresolved): string {
  return site(found.path, found.reference);
}

/**
 * Every directory holding a listed file.
 *
 * @param {readonly string[]} files - The listed files.
 * @returns {ReadonlySet<string>} Their directories and the directories' ancestors.
 */
function directories(files: readonly string[]): ReadonlySet<string> {
  const found = new Set<string>();
  for (const file of files) {
    let parent = dirname(file);
    while (parent !== '.' && !found.has(parent)) {
      found.add(parent);
      parent = dirname(parent);
    }
  }
  return found;
}

/**
 * A relative link whose file or anchor is missing.
 *
 * @param {Link} link - The link.
 * @param {readonly string[]} files - The listed files.
 * @param {ReadonlyMap<string, Doc>} docs - The docs, by path.
 * @returns {readonly Unresolved[]} The link's problem, if any.
 */
function linkProblems(link: Link, files: readonly string[], docs: ReadonlyMap<string, Doc>): readonly Unresolved[] {
  if (SCHEME.test(link.target)) {
    return [];
  }
  const [target = '', fragment = ''] = link.target.split('#');
  const resolved = target === '' ? link.path : normalize(join(dirname(link.path), decodeURI(target)));
  if (!files.includes(resolved) && !directories(files).has(resolved.replace(/\/$/u, ''))) {
    return [{ line: link.line, path: link.path, problem: 'the linked file is not listed', reference: link.target }];
  }
  if (fragment !== '' && !(docs.get(resolved)?.anchors().has(fragment) ?? false)) {
    return [{ line: link.line, path: link.path, problem: 'the anchor is not a heading of the linked file', reference: link.target }];
  }
  return [];
}

/**
 * Whether a span reads as a path: it holds a `/` or a known file suffix, and is no placeholder or URL.
 *
 * @param {string} text - The span's text.
 * @returns {boolean} Whether to resolve it as a path.
 */
function looksLikePath(text: string): boolean {
  const placeholder =
    text.replaceAll('/', '') === '' || PLACEHOLDER.test(text) || text.includes('...') || text.includes('…') || text.startsWith('-');
  if (placeholder || SCHEME.test(text)) {
    return false;
  }
  return text.includes('/') || SUFFIXES.has(extname(text));
}

/**
 * Whether `path` names a listed file or directory, or is the tail of one.
 *
 * @param {string} path - The span's path.
 * @param {readonly string[]} files - The listed files.
 * @returns {boolean} Whether it is listed.
 */
function listed(path: string, files: readonly string[]): boolean {
  const dirs = [...directories(files)];
  if (files.includes(path) || dirs.includes(path)) {
    return true;
  }
  if (!path.includes('/')) {
    return files.some((file) => basename(file) === path) || dirs.some((dir) => basename(dir) === path);
  }
  const tail = `/${path}`;
  return files.some((file) => file.endsWith(tail)) || dirs.some((dir) => dir.endsWith(tail));
}

/**
 * The first `pnpm run` task of a span that names no root script.
 *
 * @param {string} text - The span's text.
 * @param {ReadonlySet<string>} taskNames - The root script names.
 * @returns {string | undefined} The unknown task, or `undefined`.
 */
function unknownTask(text: string, taskNames: ReadonlySet<string>): string | undefined {
  for (const match of text.matchAll(PNPM_RUN)) {
    const task = match.groups?.['task'] ?? '';
    if (!taskNames.has(task)) {
      return task;
    }
  }
  return undefined;
}

/**
 * Whether a span's path is listed, from the root or the doc's folder, or under an installed package, or a named value.
 *
 * @param {Span} span - The span.
 * @param {string} path - Its text, without a trailing `/`.
 * @param {Resolver} resolver - What it resolves against.
 * @returns {boolean} Whether it resolves.
 */
function resolvesAsListed(span: Span, path: string, resolver: Resolver): boolean {
  const fromDoc = normalize(join(dirname(span.path), path));
  const [first = ''] = path.split('/');
  return (
    listed(path, resolver.files) ||
    resolver.files.includes(fromDoc) ||
    directories(resolver.files).has(fromDoc) ||
    (path.includes('/') && resolver.installed(`node_modules/${first}`)) ||
    (extname(path) === '' && resolver.named(span.text))
  );
}

/**
 * The problem of a span that reads as a path: an uninstalled package or `node_modules/` path, or an unlisted path.
 *
 * @param {Span} span - The span.
 * @param {Resolver} resolver - What it resolves against.
 * @returns {string | undefined} The problem, or `undefined` when it resolves.
 */
function pathProblem(span: Span, resolver: Resolver): string | undefined {
  const { text } = span;
  const pkg = PACKAGE.exec(text)?.groups?.['name'];
  if (pkg !== undefined) {
    return resolver.installed(`node_modules/${pkg}`) ? undefined : 'the package is not installed';
  }
  const path = text.replace(/\/$/u, '');
  if (path === 'node_modules' || path.startsWith('node_modules/')) {
    return resolver.installed(path) ? undefined : 'the path is not installed';
  }
  return resolvesAsListed(span, path, resolver) ? undefined : 'the path is not listed';
}

/**
 * The problem of a span as a path, when it reads as one.
 *
 * @param {Span} span - The span.
 * @param {Resolver} resolver - What it resolves against.
 * @returns {string | undefined} The problem, or `undefined`.
 */
function pathProblemOf(span: Span, resolver: Resolver): string | undefined {
  return looksLikePath(span.text) ? pathProblem(span, resolver) : undefined;
}

/**
 * A backticked path, package, named value or task that resolves to nothing.
 *
 * @param {Span} span - The span.
 * @param {Resolver} resolver - What it resolves against.
 * @returns {readonly Unresolved[]} The span's problem, if any.
 */
function spanProblems(span: Span, resolver: Resolver): readonly Unresolved[] {
  const task = unknownTask(span.text, resolver.taskNames);
  const problem = task === undefined ? pathProblemOf(span, resolver) : `no task is named ${JSON.stringify(task)}`;
  return problem === undefined ? [] : [{ line: span.line, path: span.path, problem, reference: span.text }];
}

/**
 * Each `ADR-NNNN` that names no decision record.
 *
 * @param {Prose} line - A line of current text.
 * @param {readonly string[]} files - The listed files.
 * @returns {readonly Unresolved[]} One problem per unrecorded number.
 */
function adrProblems(line: Prose, files: readonly string[]): readonly Unresolved[] {
  const found: Unresolved[] = [];
  for (const match of line.text.matchAll(ADR)) {
    const [reference] = match;
    const number = match.groups?.['number'] ?? '';
    if (!files.some((file) => file.startsWith(`${DECISIONS}${number}-`))) {
      found.push({ line: line.line, path: line.path, problem: 'no decision record has this number', reference });
    }
  }
  return found;
}

/**
 * Whether a shell line runs a locked tool bare or through an unlocked runner.
 *
 * @param {string} line - A line of a shell fence.
 * @returns {boolean} Whether the line breaks the rule.
 */
function runsUnlocked(line: string): boolean {
  const [first = '', second = ''] = line.trim().replace(/^\$ /u, '').split(/\s+/u);
  return LOCKED_TOOLS.has(first) || UNLOCKED_RUNNERS.has(first) || (first === 'pnpm' && second === 'dlx');
}

/**
 * Each locked tool in a shell fence run bare or through an unlocked runner.
 *
 * @param {Doc} doc - The doc.
 * @returns {readonly Unresolved[]} One problem per offending line.
 */
function fenceProblems(doc: Doc): readonly Unresolved[] {
  const found: Unresolved[] = [];
  for (const fence of doc.fences()) {
    const [language = ''] = fence.info.split(' ');
    if (SHELL_FENCES.has(language)) {
      for (const [offset, line] of fence.lines.entries()) {
        if (runsUnlocked(line)) {
          found.push({
            line: fence.line + offset + FIRST_LINE_OFFSET,
            path: doc.path,
            problem: 'a locked tool runs through pnpm',
            reference: line.trim(),
          });
        }
      }
    }
  }
  return found;
}

export type { Resolver };
export { adrProblems, fenceProblems, key, linkProblems, spanProblems };
