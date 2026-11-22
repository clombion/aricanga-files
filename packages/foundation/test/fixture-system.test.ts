import { FIXTURE_TAG, fixtureSystem, fixtureSystemErased, runFixture } from '#src/testing/index';
import { describe, expect, test } from 'vitest';
import { erase, stateOf } from '#src/sim/system';
import type { FixtureInput } from '#src/testing/harness';
import { createExperience } from '#src/core/create-experience';
import { hSystem } from '#test/h-system';
import { refusingHost } from '#test/refusing-host';
import { storyOf } from '#src/testing/compile';

/** The context a view renders with. */
const RENDER = { locale: 'en', now: 0 };

/** The seed the fixture system's initial state is built from. */
const SEED = 0;

/** A token no commit was scheduled with. */
const STALE_TOKEN = 99;

/**
 * A resume input for the fixture system.
 *
 * @param {FixtureInput['input']} input - The resume.
 * @returns {FixtureInput} The input, targeted at the fixture system.
 */
function toFixture(input: FixtureInput['input']): FixtureInput {
  return { input, target: 'fixture' };
}

describe('the fixture system', () => {
  test('turns a line tagged commit into a scheduled commit that closes its gate', async () => {
    expect.hasAssertions();
    const run = await runFixture({
      story: `Wait. # ${FIXTURE_TAG}: on # commit: 1\nAfter. # ${FIXTURE_TAG}: on\n`,
      systems: [fixtureSystemErased],
    });
    expect(run.effects.map((effect) => effect.family)).toStrictEqual(['schedule', 'present']);
    expect(run.viewOf(fixtureSystem).lines).toStrictEqual(['Wait.', 'After.']);
  });

  test('ignores a stale commit, a loaded story, a restore notice and a lifecycle input', async () => {
    expect.hasAssertions();
    const run = await runFixture({
      inputs: [
        toFixture({ resume: { kind: 'commit-fired', token: STALE_TOKEN }, source: 'resume' }),
        toFixture({ resume: { kind: 'story-loaded' }, source: 'resume' }),
        toFixture({ resume: { kind: 'restored', state: fixtureSystem.init(SEED) }, source: 'resume' }),
        { input: { lifecycle: { kind: 'reset' }, source: 'lifecycle' } },
      ],
      story: 'Only line.\n',
      systems: [fixtureSystemErased],
    });
    expect(run.viewOf(fixtureSystem)).toStrictEqual({ ...fixtureSystem.init(SEED), lines: ['Only line.'] });
  });

  test('refuses a step two systems both claim', async () => {
    expect.hasAssertions();
    await expect(
      runFixture({ story: `Both. # ${FIXTURE_TAG}: on # h: 1\n`, systems: [fixtureSystemErased, erase(hSystem)] }),
    ).rejects.toThrow('Ambiguous routing: systems [fixture, h] all claim tags in this step');
  });
});

describe('a system value read back by another system', () => {
  test('is refused, naming both systems', () => {
    expect.hasAssertions();
    expect(() => stateOf(hSystem, { systemId: 'fixture', value: fixtureSystem.init(SEED) })).toThrow(
      'a value of system "fixture" was read back as system "h"',
    );
  });
});

describe('an experience', () => {
  test('steps, sends, snapshots, restores and renders through its runtime', () => {
    expect.hasAssertions();
    const experience = createExperience({
      host: refusingHost({
        present: () => {
          // The experience presents its lines; the test reads the view instead.
        },
      }),
      ink: storyOf(`One. # ${FIXTURE_TAG}: on\nTwo. # ${FIXTURE_TAG}: on\n`),
      systems: [fixtureSystemErased],
    });
    experience.step();
    const saved = experience.snapshot();
    experience.send({ lifecycle: { kind: 'reset' }, source: 'lifecycle' });
    expect(stateOf(fixtureSystem, { systemId: 'fixture', value: experience.view('fixture', RENDER) }).lines).toStrictEqual([
      'One.',
      'Two.',
    ]);
    experience.restore(saved);
    expect(experience.snapshot()).toStrictEqual(saved);
  });
});
