/** The exit statuses the checks read off a tool's run: the one place their numbers are written. */

/** A run that found nothing. */
const EXIT_CLEAN = 0;
/** A run that reported findings. */
const EXIT_FINDINGS = 1;
/** A run that could not do its work. */
const EXIT_BROKEN = 2;

export { EXIT_BROKEN, EXIT_CLEAN, EXIT_FINDINGS };
