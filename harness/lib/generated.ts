/**
 * The generated blocks of the docs, and the generators that render them from their owners.
 *
 * A generated block is the text between `<!-- generated: <name> -->` and `<!-- end: <name> -->` in
 * a Markdown file of current text. `GENERATORS` maps each name to the function that renders it.
 * `pnpm run fix` writes the blocks; `pnpm run docs:check`, part of the gate, fails on a stale one.
 */

import type { Block, Doc } from './docs.ts';
import { UPSTREAM, pins } from './pins.ts';
import { markdown, markdownPaths } from './docs.ts';
import { Accepted } from './exemptions.ts';
import { checkModules } from './checks.ts';
import { repoTasks } from './config.ts';
import { writeText } from './source-files.ts';

/** Each generator, by the name of the blocks it renders. */
type Generators = ReadonlyMap<string, () => string>;

/** A generated block that differs from a fresh render, or that names no known generator. */
interface Problem {
  readonly path: string;
  readonly line: number;
  readonly message: string;
  readonly writingFixesIt: boolean;
}

/** The files `run` reads and writes: the repository's, or a planted set. */
interface Files {
  readonly paths: () => readonly string[];
  readonly read: (path: string) => Doc;
  readonly write: (path: string, text: string) => void;
}

/** The tasks that run no tool themselves but are the gate's entry points. */
const ENTRY_TASKS = new Accepted(['check', 'check:fast', 'lock:check', 'setup', 'fix']);
const LOCK_FIRST = 'pnpm run lock:check';

/** The lines a block's end marker takes. */
const END_MARKER_LINES = 1;

/**
 * The list of shipped checks, from each check module's `HARNESS_ID` and leading doc comment.
 *
 * @returns {string} The list, as Markdown.
 */
function checkList(): string {
  return checkModules()
    .map((module) => `- \`${module.harnessId}\` (\`${module.path}\`): ${module.summary}`)
    .join('\n');
}

/**
 * The table of pinned tools, with each tool's upstream repository.
 *
 * @returns {string} The table, as Markdown.
 */
function pinTable(): string {
  const rows = pins().map((pin) => {
    const repository = UPSTREAM.get(pin.tool);
    const upstream = repository === undefined ? 'no upstream named' : `[${repository}](https://github.com/${repository})`;
    return `| \`${pin.tool}\` | ${upstream} | \`${pin.where}\` | ${pin.version} |`;
  });
  return ['| Tool | Upstream | Pinned in | Pin |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

/**
 * The table of the harness's tasks: the entry points and every task that starts with the lock check.
 *
 * @returns {string} The table, as Markdown.
 */
function taskTable(): string {
  const rows = [...repoTasks().values()]
    .filter((task) => {
      const [first] = task.commands;
      return ENTRY_TASKS.has(task.name) || first === LOCK_FIRST;
    })
    .map((task) => `| \`pnpm run ${task.name}\` | \`${task.script.replaceAll('|', String.raw`\|`)}\` |`);
  return ['| Command | Runs |', '| --- | --- |', ...rows].join('\n');
}

/** The repository's generators. */
const GENERATORS: Generators = new Map([
  ['checks', checkList],
  ['pins', pinTable],
  ['tasks', taskTable],
]);

/**
 * What is wrong with the generated blocks of one doc.
 *
 * @param {Readonly<Doc>} doc - The doc.
 * @param {Readonly<Generators>} generators - The generators.
 * @returns {readonly Problem[]} Each stale or unknown block.
 */
function problems(doc: Readonly<Doc>, generators: Readonly<Generators>): readonly Problem[] {
  return doc.blocks().flatMap((block): Problem[] => {
    const render = generators.get(block.name);
    if (render === undefined) {
      return [
        { line: block.start, message: `no generator is named ${JSON.stringify(block.name)}`, path: doc.path, writingFixesIt: false },
      ];
    }
    return block.body === render()
      ? []
      : [
          {
            line: block.start,
            message: `block ${JSON.stringify(block.name)} is stale: run \`pnpm run fix\``,
            path: doc.path,
            writingFixesIt: true,
          },
        ];
  });
}

/**
 * The doc's text with every block whose generator is known rendered afresh.
 *
 * @param {Readonly<Doc>} doc - The doc.
 * @param {Readonly<Generators>} generators - The generators.
 * @returns {string} The rendered text.
 */
function rendered(doc: Readonly<Doc>, generators: Readonly<Generators>): string {
  const lines = [...doc.lines];
  for (const block of doc.blocks().toSorted((first, second) => second.start - first.start)) {
    const render = generators.get(block.name);
    if (render !== undefined) {
      lines.splice(block.start, block.end - END_MARKER_LINES - block.start, ...render().split('\n'));
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Every generated block of the docs of current text.
 *
 * @returns {readonly Block[]} The blocks.
 */
function blocks(): readonly Block[] {
  return markdownPaths().flatMap((path) => markdown(path).blocks());
}

const REPO_FILES: Files = {
  paths: markdownPaths,
  read: markdown,
  write: writeText,
};

/**
 * Write the generated blocks, or with `check` report the stale ones.
 *
 * @param {boolean} check - Whether to compare and write nothing.
 * @param {Readonly<Generators>} generators - The generators.
 * @param {Files} files - The files read and written.
 * @returns {readonly Problem[]} The problems left: with `check` every problem; without it, only those writing cannot fix (an unknown block name).
 */
function run(check: boolean, generators: Readonly<Generators> = GENERATORS, files: Files = REPO_FILES): readonly Problem[] {
  const found = files.paths().flatMap((path) => {
    const doc = files.read(path);
    const fresh = rendered(doc, generators);
    if (!check && fresh !== doc.text) {
      files.write(path, fresh);
    }
    return problems(doc, generators);
  });
  return found.filter((problem) => check || !problem.writingFixesIt);
}

export { blocks, GENERATORS, problems, rendered, run };
export type { Files, Generators };
