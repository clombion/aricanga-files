/**
 * The generated blocks of the docs, and the generators that render them from their owners.
 *
 * A generated block is the text between `<!-- generated: <name> -->` and `<!-- end: <name> -->` in
 * a Markdown file of current text. `GENERATORS` maps each name to the function that renders it.
 * `pnpm run fix` writes the blocks; `pnpm run docs:check`, part of the gate, fails on a stale one.
 */

import type { Block, Doc } from './docs.ts';
import { HARNESS_CHECKS, VITEST_TESTS } from './test-globs.ts';
import { checkList, pinTable, taskTable } from './generated-render.ts';
import { markdown, markdownDocs, markdownPaths } from './docs.ts';
import { textsOf, tracked, writeText } from './source-files.ts';
import { Accepted } from './exemptions.ts';
import { UPSTREAM } from './upstream.ts';
import { checkModules } from './checks.ts';
import { matches } from './globs.ts';
import { pins } from './pins.ts';
import { repoTasks } from './config.ts';

/** Each generator, by the name of the blocks it renders. */
type Generators = ReadonlyMap<string, () => Promise<string>>;

/** A generated block that differs from a fresh render, or that names no known generator. */
interface Problem {
  readonly path: string;
  readonly line: number;
  readonly message: string;
  readonly writingFixesIt: boolean;
}

/** The files `run` reads and writes: the repository's, or a planted set. */
interface Files {
  readonly paths: () => Promise<readonly string[]>;
  readonly read: (path: string) => Promise<Doc>;
  readonly write: (path: string, text: string) => Promise<void>;
}

/** The tasks that run no tool themselves but are the gate's entry points. */
const ENTRY_TASKS = new Accepted(['check', 'check:fast', 'lock:check', 'setup', 'fix']);

/** The lines a block's end marker takes. */
const END_MARKER_LINES = 1;

/**
 * The list of shipped checks, from every listed check module.
 *
 * @returns {Promise<string>} The list, as Markdown.
 */
async function checks(): Promise<string> {
  const listed = await tracked();
  const texts = await textsOf(listed.filter((path) => path.startsWith(HARNESS_CHECKS) && matches(VITEST_TESTS, path)));
  return checkList(checkModules(texts));
}

/**
 * The table of pinned tools.
 *
 * @returns {Promise<string>} The table, as Markdown.
 */
async function pinned(): Promise<string> {
  const found = await pins();
  return pinTable(found, UPSTREAM);
}

/**
 * The table of the harness's tasks.
 *
 * @returns {Promise<string>} The table, as Markdown.
 */
async function tasks(): Promise<string> {
  const found = await repoTasks();
  return taskTable([...found.values()], ENTRY_TASKS.values);
}

/** The repository's generators. */
const GENERATORS: Generators = new Map([
  ['checks', checks],
  ['pins', pinned],
  ['tasks', tasks],
]);

/**
 * A fresh render of every known generator a doc's blocks name, by name.
 *
 * @param {Readonly<Doc>} doc - The doc.
 * @param {Readonly<Generators>} generators - The generators.
 * @returns {Promise<ReadonlyMap<string, string>>} Each named generator's render.
 */
async function renders(doc: Readonly<Doc>, generators: Readonly<Generators>): Promise<ReadonlyMap<string, string>> {
  const names = [...new Set(doc.blocks().map((block) => block.name))];
  const known = names.flatMap((name) => {
    const render = generators.get(name);
    return render === undefined ? [] : [[name, render] as const];
  });
  const texts = await Promise.all(
    known.map(async ([name, render]: readonly [string, () => Promise<string>]) => {
      const text = await render();
      return [name, text] as const;
    }),
  );
  return new Map(texts);
}

/**
 * What is wrong with the generated blocks of one doc.
 *
 * @param {Readonly<Doc>} doc - The doc.
 * @param {Readonly<Generators>} generators - The generators.
 * @returns {Promise<readonly Problem[]>} Each stale or unknown block.
 */
async function problems(doc: Readonly<Doc>, generators: Readonly<Generators>): Promise<readonly Problem[]> {
  const fresh = await renders(doc, generators);
  return doc.blocks().flatMap((block): Problem[] => {
    const render = fresh.get(block.name);
    if (render === undefined) {
      return [{ line: block.start, message: `no generator is named ${JSON.stringify(block.name)}`, path: doc.path, writingFixesIt: false }];
    }
    return block.body === render
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
 * @returns {Promise<string>} The rendered text.
 */
async function rendered(doc: Readonly<Doc>, generators: Readonly<Generators>): Promise<string> {
  const fresh = await renders(doc, generators);
  const lines = [...doc.lines];
  for (const block of doc.blocks().toSorted((first, second) => second.start - first.start)) {
    const render = fresh.get(block.name);
    if (render !== undefined) {
      lines.splice(block.start, block.end - END_MARKER_LINES - block.start, ...render.split('\n'));
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Every generated block of the docs of current text.
 *
 * @returns {Promise<readonly Block[]>} The blocks.
 */
async function blocks(): Promise<readonly Block[]> {
  const docs = await markdownDocs();
  return docs.flatMap((doc) => doc.blocks());
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
 * @returns {Promise<readonly Problem[]>} The problems left: with `check` every problem; without it, only those writing cannot fix (an unknown block name).
 */
async function run(check: boolean, generators: Readonly<Generators> = GENERATORS, files: Files = REPO_FILES): Promise<readonly Problem[]> {
  const paths = await files.paths();
  const found = await Promise.all(
    paths.map(async (path) => {
      const doc = await files.read(path);
      const fresh = await rendered(doc, generators);
      if (!check && fresh !== doc.text) {
        await files.write(path, fresh);
      }
      const docProblems = await problems(doc, generators);
      return docProblems;
    }),
  );
  return found.flat().filter((problem) => check || !problem.writingFixesIt);
}

export { blocks, GENERATORS, problems, rendered, run };
export type { Files, Generators, Problem };
