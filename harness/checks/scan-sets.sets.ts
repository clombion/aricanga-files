/** The scan sets of the `scan-sets` check: the files each tool reaches, read from the tool itself. */

import { ConfigError, absentAs, object, strings } from '#lib/config.ts';
import type { Dir, MemberDir } from '#lib/package-dirs.ts';
import { Project, finished } from '#lib/tools.ts';
import { REPO_ROOT, fromRoot } from '#lib/paths.ts';
import { dirOfImporter, nearestOf } from '#lib/package-dirs.ts';
import { textsOf, tracked } from '#lib/source-files.ts';
import { dirname } from 'node:path/posix';
import { knipConfig } from '#lib/config-modules.ts';
import { matches } from '#lib/globs.ts';
import { projects } from '#lib/projects.ts';
import { relativeTo } from '#lib/relative.ts';

const UNFORMATTED = '\nconst   plantedUnformatted   =   1  ;\n';

/**
 * The lines of a tool's output that name something.
 *
 * @param {string} stdout - The tool's output.
 * @returns {readonly string[]} Its non-empty lines.
 */
function lines(stdout: string): readonly string[] {
  return stdout.split('\n').filter((line) => line !== '');
}

/**
 * The files oxlint lints in the checkout, from its own listing.
 *
 * @returns {Promise<ReadonlySet<string>>} The files oxlint lints.
 */
async function oxlintFiles(): Promise<ReadonlySet<string>> {
  const done = await finished([fromRoot('node_modules', '.bin', 'oxlint'), '--debug=files'], { cwd: REPO_ROOT });
  return new Set(lines(done.stdout));
}

/**
 * The files oxfmt formats: every held file planted unformatted in a copy of the checkout's config.
 *
 * @param {readonly string[]} files - The held files.
 * @returns {Promise<ReadonlySet<string>>} The files oxfmt would change.
 */
async function oxfmtFiles(files: readonly string[]): Promise<ReadonlySet<string>> {
  const listed = await tracked();
  const ignores = ['.gitignore', '.prettierignore', '.oxfmtrc.json'].filter((path) => listed.includes(path));
  const project = await Project.create({ copies: ignores });
  try {
    const texts = await textsOf(files);
    await project.writeAll(texts.map(([path, text]: readonly [string, string]) => [path, text + UNFORMATTED] as const));
    const done = await project.tool('oxfmt', '--list-different');
    return new Set(lines(done.stdout));
  } finally {
    await project.remove();
  }
}

/** A knip glob's production mark, which does not change what it matches. */
const PRODUCTION_MARK = /!$/u;

/** A workspace of knip's configuration: its directory and the globs of its project and entries. */
interface KnipWorkspace {
  readonly dir: Dir;
  readonly globs: readonly string[];
}

/** A member's workspace: one whose directory is a member's. */
type MemberWorkspace = KnipWorkspace & { readonly dir: MemberDir };

/**
 * A workspace of knip's configuration, by its importer-spelled name.
 *
 * @param {string} name - The workspace's name (`.` for the root).
 * @param {unknown} settings - Its settings.
 * @returns {KnipWorkspace} Its directory and globs, repository-relative.
 */
function knipWorkspace(name: string, settings: unknown): KnipWorkspace {
  const dir = dirOfImporter(name);
  const fields = object(settings, name);
  const globs = [
    ...strings(absentAs(fields['project'], []), `${name}.project`),
    ...strings(absentAs(fields['entry'], []), `${name}.entry`),
  ];
  const negated = globs.find((glob) => glob.startsWith('!'));
  if (negated !== undefined) {
    throw new ConfigError(`${name}: the reach check reads no negated knip glob, and the configuration holds ${negated}`);
  }
  return { dir, globs: globs.map((glob) => `${dir}${glob.replace(PRODUCTION_MARK, '')}`) };
}

/**
 * Whether a workspace is a member's.
 *
 * @param {KnipWorkspace} workspace - The workspace.
 * @returns {boolean} Whether its directory is a member's.
 */
function isMemberWorkspace(workspace: KnipWorkspace): workspace is MemberWorkspace {
  return workspace.dir !== '';
}

/**
 * The files knip's project or entries hold, as the loaded configuration declares them: each file
 * matched by a `project` or `entry` glob of the workspace holding it (the nearest member's, else the root's).
 *
 * @param {readonly string[]} files - The held files.
 * @returns {Promise<ReadonlySet<string>>} The files knip's globs reach.
 */
async function knipFiles(files: readonly string[]): Promise<ReadonlySet<string>> {
  const config = await knipConfig();
  const workspaces = Object.entries(object(absentAs(config['workspaces'], {}), 'workspaces')).map(
    ([name, settings]: readonly [string, unknown]) => knipWorkspace(name, settings),
  );
  const root = workspaces.find((workspace) => !isMemberWorkspace(workspace));
  const holding = nearestOf(
    workspaces.filter((workspace) => isMemberWorkspace(workspace)),
    (workspace) => workspace.dir,
  );
  return new Set(files.filter((file) => (holding(file) ?? root)?.globs.some((glob) => matches(glob, file)) === true));
}

/**
 * The directory a project file sits in, with a trailing slash (empty at the root).
 *
 * @param {string} project - The project file.
 * @returns {string} Its directory.
 */
function projectDirectory(project: string): string {
  const directory = dirname(project);
  return directory === '.' ? '' : `${directory}/`;
}

/**
 * The files each TypeScript project holds: those it lists (`tsc --listFilesOnly`) under its own
 * directory. A package's source a dependent project resolves through the package's exports is
 * listed there too, but held by its own package.
 *
 * @returns {Promise<ReadonlyMap<string, ReadonlySet<string>>>} Each project's held files, by project.
 */
async function projectMembers(): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  const all = await projects();
  const members = await Promise.all(
    all.map(async (project) => {
      const done = await finished([fromRoot('node_modules', '.bin', 'tsc'), '--listFilesOnly', '-p', project], { cwd: REPO_ROOT });
      const listed = lines(done.stdout).map((path) => relativeTo(REPO_ROOT, path));
      return [project, new Set(listed.filter((path) => path.startsWith(projectDirectory(project))))] as const;
    }),
  );
  return new Map(members);
}

export { knipFiles, knipWorkspace, oxfmtFiles, oxlintFiles, projectDirectory, projectMembers };
