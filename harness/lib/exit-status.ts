/**
 * The exit statuses the harness reads off a process it runs: git, pnpm, Vite, Vitest, tsc, jscpd,
 * oxlint, knip and Playwright. Each tool states its own codes; these are the names the harness reads
 * them by, and a clean exit is 0 for every one of them. They are not the harness's own: the codes its
 * scripts end with are `output.ts`'s `EXIT_SUCCESS` and `EXIT_FAILURE`, and a check that runs one of
 * those scripts reads its status as those.
 */

/** A run that found nothing. */
const EXIT_CLEAN = 0;
/** A run that reported findings. */
const EXIT_FINDINGS = 1;
/** A run that could not do its work. */
const EXIT_BROKEN = 2;

/**
 * Whether a tool's finished process exited cleanly.
 *
 * @param {Readonly<{ status: number | null }>} outcome - The finished process.
 * @returns {boolean} Whether its status is `EXIT_CLEAN`.
 */
function succeeded(outcome: Readonly<{ status: number | null }>): boolean {
  return outcome.status === EXIT_CLEAN;
}

export { EXIT_BROKEN, EXIT_CLEAN, EXIT_FINDINGS, succeeded };
