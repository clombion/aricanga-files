import fc from 'fast-check';
import type { InkStep, Tag } from '../sim/story';
import type { FixtureInput } from './harness';

// Coherent generators for property tests — they only produce InkStep shapes the
// real ink pump actually emits (a continuable line with tags, no choices/externals),
// so a counterexample is a real one, not a malformed step the runtime never sees.

export function tagArb(keys: readonly string[]): fc.Arbitrary<Tag> {
  return fc
    .tuple(fc.constantFrom(...keys), fc.string({ minLength: 1, maxLength: 8 }))
    .map(([key, value]) => ({ key, value, raw: `${key}: ${value}` }));
}

export interface StepGenOptions {
  /** Tag keys the generated step may carry. */
  readonly tagKeys?: readonly string[];
  /** Restrict the generated text to a fixed pool (else a short random string). */
  readonly texts?: readonly string[];
  readonly maxTags?: number;
}

export function inkStepArb(opts: StepGenOptions = {}): fc.Arbitrary<InkStep> {
  const keys = opts.tagKeys ?? ['speaker'];
  const text = opts.texts ? fc.constantFrom(...opts.texts) : fc.string({ minLength: 1, maxLength: 12 });
  return fc
    .record({ text, tags: fc.array(tagArb(keys), { maxLength: opts.maxTags ?? 3 }) })
    .map(({ text, tags }) => ({
      text,
      tags,
      choices: [],
      externalCalls: [],
      status: 'continue' as const,
    }));
}

/** A single `Story(InkStep)` input, ready for the property runner. */
export function storyInputArb(opts?: StepGenOptions): fc.Arbitrary<FixtureInput> {
  return inkStepArb(opts).map((step) => ({ input: { source: 'story', step } }));
}

/** A sequence of `Story(InkStep)` inputs. */
export function storyStreamArb(opts?: StepGenOptions, maxLength = 8): fc.Arbitrary<FixtureInput[]> {
  return fc.array(storyInputArb(opts), { maxLength });
}
