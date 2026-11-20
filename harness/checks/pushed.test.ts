/**
 * The pre-push hook refuses a `fixup!`, `squash!` or `amend!` commit in the pushed range.
 *
 * Planted end to end in a scratch repository: the hook's script reads the refs git hands it and
 * fails on a fold commit in the range, and lets a subject that only mentions a fixup through.
 */

import { describe, expect, test } from 'vitest';
import { refused, revisions, updates } from '#lib/pushed.ts';
import { Project } from '#lib/tools.ts';
import { fromRoot } from '#lib/paths.ts';

const HARNESS_ID = 'pushed-subjects';

const ZEROS = '0'.repeat(40);

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
    expect(parsed.map(revisions)).toStrictEqual([['bbb..aaa'], ['ddd', '--not', '--remotes']]);
  });
});

/**
 * The pre-push script's exit status for a push of `subjects` onto a base commit.
 *
 * @param {readonly string[]} subjects - The subjects of the pushed commits.
 * @returns {number} The pre-push script's exit status for a push of `subjects` onto a base commit.
 */
function pushOf(subjects: readonly string[]): number {
  const project = new Project({ linkModules: false });
  try {
    const git = (...args: string[]) => project.run('git', '-c', 'user.name=plant', '-c', 'user.email=plant@example.invalid', ...args);
    git('init', '-q', '-b', 'main');
    git('commit', '-q', '--allow-empty', '-m', 'chore: base');
    const base = git('rev-parse', 'HEAD').stdout.trim();
    for (const subject of subjects) {
      git('commit', '-q', '--allow-empty', '-m', subject);
    }
    const head = git('rev-parse', 'HEAD').stdout.trim();
    return project.runWithInput(`refs/heads/main ${head} refs/heads/main ${base}\n`, 'node', fromRoot('harness/scripts/check-pushed.ts')).status;
  } finally {
    project.remove();
  }
}

describe('the pre-push script', () => {

  test('fails on a fold commit in the pushed range', () => {
    expect.hasAssertions();
    expect(pushOf(['feat: one', 'fixup! feat: one'])).toBe(1);
  });

  test('passes a range of ordinary commits', () => {
    expect.hasAssertions();
    expect(pushOf(['feat: one', 'fix: fixup! handling'])).toBe(0);
  });
});

export { HARNESS_ID };
