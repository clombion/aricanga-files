/** The one module of the harness's scripts that writes to the standard streams. */

/** Write a script's result to standard output, as given. */
export function out(text: string): void {
  process.stdout.write(text);
}

/** Write why a script failed to standard error, as given. */
export function err(text: string): void {
  process.stderr.write(text);
}

/** Say a line of a script's result on standard output. */
export function say(text: string): void {
  out(`${text}\n`);
}

/** Say why a script failed on standard error, as a line. */
export function complain(text: string): void {
  err(`${text}\n`);
}
