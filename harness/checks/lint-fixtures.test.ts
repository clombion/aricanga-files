/** Two fixtures planted at one path are refused before any lint runs. */

import { FixtureError, lintFixtures } from '#lib/lint-rules.ts';
import { describe, expect, test } from 'vitest';

const FIXTURE = { file: 'planted/fire.fixture', kind: 'fire', path: 'src/planted.ts', rule: 'planted', source: '' } as const;

describe('the fixtures of one run', () => {
  test('refuse two planted at one path, naming it', async () => {
    expect.hasAssertions();
    await expect(lintFixtures([FIXTURE, { ...FIXTURE, file: 'planted/clean.fixture', kind: 'clean' }])).rejects.toThrow(
      new FixtureError('two fixtures are planted at src/planted.ts'),
    );
  });
});
