/** The pre-push refusal of a pushed `fixup!`, `squash!` or `amend!` commit. */

const ZERO = /^0+$/;
const FOLD = /^(fixup|squash|amend)! /;

/** A ref update git hands the pre-push hook on its standard input. */
interface Update {
  readonly localSha: string;
  readonly remoteSha: string;
}

/** Parse the pre-push hook's standard input; a deleted ref pushes nothing and is dropped. */
export function updates(stdin: string): readonly Update[] {
  return stdin
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .flatMap(([, localSha, , remoteSha]) =>
      localSha === undefined || remoteSha === undefined || ZERO.test(localSha) ? [] : [{ localSha, remoteSha }],
    );
}

/** The `git rev-list` arguments naming the commits an update pushes. */
export function revisions(update: Update): readonly string[] {
  return ZERO.test(update.remoteSha)
    ? [update.localSha, '--not', '--remotes']
    : [`${update.remoteSha}..${update.localSha}`];
}

/** The subjects a push must not carry. */
export function refused(subjects: readonly string[]): readonly string[] {
  return subjects.filter((subject) => FOLD.test(subject));
}
