/** The pre-push refusal of a pushed `fixup!`, `squash!` or `amend!` commit. */

/** A sha of zeros: the ref does not exist on that side. */
const ZERO = /^0+$/u;

/** A subject that asks to be folded into another commit. */
const FOLD = /^(?:fixup|squash|amend)! /u;

const WHITESPACE = /\s+/u;

/** A ref update git hands the pre-push hook on its standard input. */
interface Update {
  readonly localSha: string;
  readonly remoteSha: string;
}

/**
 * Parse the pre-push hook's standard input; a deleted ref pushes nothing and is dropped.
 *
 * @param {string} stdin - The hook's standard input: one `<local ref> <local sha> <remote ref> <remote sha>` per line.
 * @returns {readonly Update[]} The updates that push commits.
 */
function updates(stdin: string): readonly Update[] {
  return stdin
    .split('\n')
    .map((line) => line.trim().split(WHITESPACE))
    .flatMap(([, localSha, , remoteSha]: readonly (string | undefined)[]) =>
      localSha === undefined || remoteSha === undefined || ZERO.test(localSha) ? [] : [{ localSha, remoteSha }],
    );
}

/**
 * The `git rev-list` arguments naming the commits an update pushes.
 *
 * @param {Update} update - The ref update.
 * @returns {readonly string[]} The revision arguments.
 */
function revisions(update: Update): readonly string[] {
  return ZERO.test(update.remoteSha) ? [update.localSha, '--not', '--remotes'] : [`${update.remoteSha}..${update.localSha}`];
}

/**
 * The subjects a push must not carry.
 *
 * @param {readonly string[]} subjects - The pushed commits' subjects.
 * @returns {readonly string[]} The subjects that ask to be folded.
 */
function refused(subjects: readonly string[]): readonly string[] {
  return subjects.filter((subject) => FOLD.test(subject));
}

export { refused, revisions, updates };
