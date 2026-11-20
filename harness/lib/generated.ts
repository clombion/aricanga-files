/**
 * The generated blocks of the docs, and the generators that render them from their owners.
 *
 * A generated block is the text between `<!-- generated: <name> -->` and `<!-- end: <name> -->` in
 * a Markdown file of current text. `GENERATORS` maps each name to the function that renders it.
 * `pnpm run fix` writes the blocks; `pnpm run docs:check`, part of the gate, fails on a stale one.
 */

import { writeFileSync } from 'node:fs';

import { checkModules } from './checks.ts';
import { repoTasks } from './config.ts';
import { type Block, type Doc, markdown, markdownPaths } from './docs.ts';
import { Accepted } from './exemptions.ts';
import { fromRoot } from './paths.ts';
import { pins, UPSTREAM } from './pins.ts';

export type Generators = ReadonlyMap<string, () => string>;

/** The tasks that run no tool themselves but are the gate's entry points. */
const ENTRY_TASKS = new Accepted(['check', 'check:fast', 'lock:check', 'setup', 'fix']);
const LOCK_FIRST = 'pnpm run lock:check';

/** The list of shipped checks, from each check module's `HARNESS_ID` and leading doc comment. */
function checkList(): string {
  return checkModules()
    .map((module) => `- \`${module.harnessId}\` (\`${module.path}\`): ${module.summary}`)
    .join('\n');
}

/** The table of pinned tools, with each tool's upstream repository. */
function pinTable(): string {
  const rows = pins().map((pin) => {
    const repository = UPSTREAM.get(pin.tool);
    const upstream = repository === undefined ? 'no upstream named' : `[${repository}](https://github.com/${repository})`;
    return `| \`${pin.tool}\` | ${upstream} | \`${pin.where}\` | ${pin.version} |`;
  });
  return ['| Tool | Upstream | Pinned in | Pin |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

/** The table of the harness's tasks: the entry points and every task that starts with the lock check. */
function taskTable(): string {
  const rows = [...repoTasks().values()]
    .filter((task) => ENTRY_TASKS.has(task.name) || task.commands[0] === LOCK_FIRST)
    .map((task) => `| \`pnpm run ${task.name}\` | \`${task.script.replaceAll('|', String.raw`\|`)}\` |`);
  return ['| Command | Runs |', '| --- | --- |', ...rows].join('\n');
}

export const GENERATORS: Generators = new Map([
  ['checks', checkList],
  ['pins', pinTable],
  ['tasks', taskTable],
]);

/** A generated block that differs from a fresh render, or that names no known generator. */
interface Problem {
  readonly path: string;
  readonly line: number;
  readonly message: string;
  readonly writingFixesIt: boolean;
}

/** What is wrong with the generated blocks of one doc. */
export function problems(doc: Doc, generators: Generators): readonly Problem[] {
  return doc.blocks().flatMap((block): Problem[] => {
    const render = generators.get(block.name);
    if (render === undefined) {
      return [
        { path: doc.path, line: block.start, message: `no generator is named ${JSON.stringify(block.name)}`, writingFixesIt: false },
      ];
    }
    return block.body === render()
      ? []
      : [
          {
            path: doc.path,
            line: block.start,
            message: `block ${JSON.stringify(block.name)} is stale: run \`pnpm run fix\``,
            writingFixesIt: true,
          },
        ];
  });
}

/** The doc's text with every block whose generator is known rendered afresh. */
export function rendered(doc: Doc, generators: Generators): string {
  const lines = [...doc.lines];
  for (const block of doc.blocks().toSorted((a, b) => b.start - a.start)) {
    const render = generators.get(block.name);
    if (render !== undefined) {
      lines.splice(block.start, block.end - 1 - block.start, ...render().split('\n'));
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Every generated block of the docs of current text. */
export function blocks(): readonly Block[] {
  return markdownPaths().flatMap((path) => markdown(path).blocks());
}

/** The files `run` reads and writes: the repository's, or a planted set. */
export interface Files {
  readonly paths: () => readonly string[];
  readonly read: (path: string) => Doc;
  readonly write: (path: string, text: string) => void;
}

const REPO_FILES: Files = {
  paths: markdownPaths,
  read: markdown,
  write: (path, text) => {
    writeFileSync(fromRoot(path), text, 'utf8');
  },
};

/**
 * Write the generated blocks, or with `check` report the stale ones. Returns the problems left: with
 * `check` every problem; without it, only those writing cannot fix (an unknown block name).
 */
export function run(check: boolean, generators: Generators = GENERATORS, files: Files = REPO_FILES): readonly Problem[] {
  const found: Problem[] = [];
  for (const path of files.paths()) {
    const doc = files.read(path);
    found.push(...problems(doc, generators));
    const fresh = rendered(doc, generators);
    if (!check && fresh !== doc.text) {
      files.write(path, fresh);
    }
  }
  return found.filter((problem) => check || !problem.writingFixesIt);
}
