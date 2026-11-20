import type { InkStep, Tag } from '#src/sim/story';
import { array, constantFrom, record, string, tuple } from 'fast-check';
import type { Arbitrary } from 'fast-check';
import type { FixtureInput } from './harness';

/*
 * Coherent generators for property tests — they only produce InkStep shapes the
 * real ink pump actually emits (a continuable line with tags, no choices/externals),
 * so a counterexample is a real one, not a malformed step the runtime never sees.
 */

/** The longest generated tag value. */
const MAX_TAG_VALUE = 8;

/** The longest generated line of text. */
const MAX_TEXT = 12;

/** The most tags a generated step carries unless told otherwise. */
const MAX_TAGS = 3;

/** The longest generated stream unless told otherwise. */
const MAX_STREAM = 8;

/** The shortest generated text: never empty. */
const MIN_TEXT = 1;

/** @public */
interface StepGenOptions {
  /** Tag keys the generated step may carry. */
  readonly tagKeys?: readonly string[];
  /** Restrict the generated text to a fixed pool (else a short random string). */
  readonly texts?: readonly string[];
  readonly maxTags?: number;
}

/**
 * A tag with one of the given keys and a short value.
 *
 * @param {readonly string[]} keys - The keys a tag may have.
 * @returns {Arbitrary<Tag>} The generator.
 */
function tagArb(keys: readonly string[]): Arbitrary<Tag> {
  return tuple(constantFrom(...keys), string({ maxLength: MAX_TAG_VALUE, minLength: MIN_TEXT })).map(
    ([key, value]: readonly [string, string]) => ({
      key,
      raw: `${key}: ${value}`,
      value,
    }),
  );
}

/**
 * A continuable ink step: a line with tags and no choices or externals.
 *
 * @param {StepGenOptions} opts - The keys, texts and tag count to generate from.
 * @returns {Arbitrary<InkStep>} The generator.
 */
function inkStepArb(opts: Readonly<StepGenOptions> = {}): Arbitrary<InkStep> {
  const keys = opts.tagKeys ?? ['speaker'];
  const textArb = opts.texts ? constantFrom(...opts.texts) : string({ maxLength: MAX_TEXT, minLength: MIN_TEXT });
  return record({ tags: array(tagArb(keys), { maxLength: opts.maxTags ?? MAX_TAGS }), text: textArb }).map(
    ({ tags, text }: Readonly<{ tags: readonly Tag[]; text: string }>) => ({
      choices: [],
      externalCalls: [],
      status: 'continue' as const,
      tags,
      text,
    }),
  );
}

/**
 * A single `Story(InkStep)` input, ready for the property runner.
 *
 * @param {StepGenOptions} [opts] - The step generator's options.
 * @returns {Arbitrary<FixtureInput>} The generator.
 */
function storyInputArb(opts?: Readonly<StepGenOptions>): Arbitrary<FixtureInput> {
  return inkStepArb(opts).map((step) => ({ input: { source: 'story', step } }));
}

/**
 * A sequence of `Story(InkStep)` inputs.
 *
 * @param {StepGenOptions} [opts] - The step generator's options.
 * @param {number} maxLength - The longest stream.
 * @returns {Arbitrary<FixtureInput[]>} The generator.
 */
function storyStreamArb(opts?: Readonly<StepGenOptions>, maxLength: number = MAX_STREAM): Arbitrary<FixtureInput[]> {
  return array(storyInputArb(opts), { maxLength });
}

export { inkStepArb, storyInputArb, storyStreamArb, tagArb };
export type { StepGenOptions };
