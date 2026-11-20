/**
 * The pre-push hook refuses a `fixup!`, `squash!` or `amend!` commit in the pushed range.
 *
 * Planted end to end in a scratch repository: the hook's script reads the refs git hands it and
 * fails on a fold commit in the range, and lets a subject that only mentions a fixup through.
 */

import { EXIT_CLEAN, EXIT_FINDINGS } from './exit-status.ts';
import { describe, expect, test } from 'vitest';
import { refused, revisions, updates } from '#lib/pushed.ts';
import type { Finished } from '#lib/process.ts';
import { Project } from '#lib/tools.ts';
import { fromRoot } from '#lib/paths.ts';
import { inSequence } from '#lib/lists.ts';

const HARNESS_ID = 'pushed-subjects';

/** The width of a full SHA-1 object name. */
const SHA_LENGTH = 40;
const ZEROS = '0'.repeat(SHA_LENGTH);

describe('the pushed-subjects rule', () => {
  test.each(['fixup! parse the tag', 'squash! parse the tag', 'amend! parse the tag'])('refuses %s', (subject) => {
    expect.hasAssertions();
    expect(refused([subject, 'feat(chat): parse the tag'])).toStrictEqual([subject]);
  });

  test('lets a subject that only mentions a fold through', () => {
    expect.hasAssertions();
    expect(refused(['fix: fixup! handling in the parser', 'docs: explain squash! commits'])).toStrictEqual([]);
  });

  test('reads the pushed refs, drops a deleted ref, and ranges a new branch against the remotes', () => {
    expect.hasAssertions();
    const parsed = updates(`refs/heads/a aaa refs/heads/a bbb\nrefs/heads/b ${ZEROS} refs/heads/b ccc\nrefs/heads/c ddd refs/heads/c ${ZEROS}\n`);
    expect(parsed).toStrictEqual([
      { localSha: 'aaa', remoteSha: 'bbb' },
      { localSha: 'ddd', remoteSha: ZEROS },
    ]);
    expect(parsed.map((update) => revisions(update))).toStrictEqual([['bbb..aaa'], ['ddd', '--not', '--remotes']]);
  });
});

/**
 * Commit a base and then `subjects` in a fresh repository.
 *
 * @param {Project} project - The planted project.
 * @param {readonly string[]} subjects - The subjects to commit after the base.
 * @returns {Promise<readonly [string, string]>} The base commit and the head.
 */
async function commitRange(project: Project, subjects: readonly string[]): Promise<readonly [string, string]> {
  const git = async (...args: readonly string[]): Promise<Finished> => {
    const done = await project.run('git', '-c', 'user.name=plant', '-c', 'user.email=plant@example.invalid', ...args);
    return done;
  };
  await git('init', '-q', '-b', 'main');
  await git('commit', '-q', '--allow-empty', '-m', 'chore: base');
  const base = await git('rev-parse', 'HEAD');
  await inSequence(subjects, async (subject) => {
    const done = await git('commit', '-q', '--allow-empty', '-m', subject);
    return done;
  });
  const head = await git('rev-parse', 'HEAD');
  return [base.stdout.trim(), head.stdout.trim()];
}

/**
 * The pre-push script's exit status for a push of `subjects` onto a base commit.
 *
 * @param {readonly string[]} subjects - The subjects of the pushed commits.
 * @returns {Promise<number>} The pre-push script's exit status for a push of `subjects` onto a base commit.
 */
async function pushOf(subjects: readonly string[]): Promise<number> {
  const project = await Project.create({ linkModules: false });
  try {
    const [base, head] = await commitRange(project, subjects);
    const done = await project.runWithInput(`refs/heads/main ${head} refs/heads/main ${base}\n`, 'node', fromRoot('harness/scripts/check-pushed.ts'));
    return done.status;
  } finally {
    await project.remove();
  }
}

describe('the pre-push script', () => {

  test('fails on a fold commit in the pushed range', async () => {
    expect.hasAssertions();
    await expect(pushOf(['feat: one', 'fixup! feat: one'])).resolves.toBe(EXIT_FINDINGS);
  });

  test('passes a range of ordinary commits', async () => {
    expect.hasAssertions();
    await expect(pushOf(['feat: one', 'fix: fixup! handling'])).resolves.toBe(EXIT_CLEAN);
  });
});

export { HARNESS_ID };
