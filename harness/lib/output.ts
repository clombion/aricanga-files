/** The one module of the harness's scripts that writes to the standard streams. */

/** Say a line of a script's result on standard output. */
export function say(text: string): void {
  process.stdout.write(`${text}\n`);
}

/** Say why a script failed on standard error. */
export function complain(text: string): void {
  process.stderr.write(`${text}\n`);
}
