import { Compiler } from 'inkjs/full';
import { InkRuntime } from '#src/ink/ink-runtime';

/**
 * Compile ink source to story JSON headlessly.
 *
 * @param {string} source - The ink source.
 * @returns {string} The compiled story's JSON text.
 */
function compileInk(source: string): string {
  return new Compiler(source).Compile().ToJson() ?? '';
}

/**
 * The ink runtime of a story written as ink source, compiled headlessly.
 *
 * @param {string} source - The ink source.
 * @returns {InkRuntime} The story's runtime.
 */
function storyOf(source: string): InkRuntime {
  return new InkRuntime(compileInk(source));
}

export { compileInk, storyOf };
