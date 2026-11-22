import { Compiler } from 'inkjs/full';
import { InkRuntime } from '#src/ink/ink-runtime';
import { readerOf } from '#src/sim/parse';

/** The reader of the compiler's output, which inkjs types as text or nothing. */
const READ = readerOf('ink compiler');

/**
 * Compile ink source to story JSON headlessly.
 *
 * @param {string} source - The ink source.
 * @returns {string} The compiled story's JSON text.
 */
function compileInk(source: string): string {
  return READ.string(new Compiler(source).Compile().ToJson(), 'the compiled story');
}

/**
 * The ink runtime of a story written as ink source, compiled headlessly.
 *
 * @param {string} source - The ink source.
 * @returns {InkRuntime} The story's runtime.
 */
function storyOf(source: string): InkRuntime {
  return InkRuntime.fromJson(compileInk(source));
}

export { compileInk, storyOf };
