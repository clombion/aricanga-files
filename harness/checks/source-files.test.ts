/** The fixers' writer writes a repository file as given, read back as written. */

import { describe, expect, test } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { textOf, writeText } from '#lib/source-files.ts';
import { fromRoot } from '#lib/paths.ts';

/** A folder git ignores, so writing under it changes nothing the gate reads. */
const FOLDER = 'node_modules/.harness-planted';

/** The planted file, under the ignored folder. */
const PLANTED = `${FOLDER}/written.txt`;

describe("the fixers' writer", () => {
  test('writes a file that reads back as written', async () => {
    expect.hasAssertions();
    await mkdir(fromRoot(FOLDER), { recursive: true });
    try {
      await writeText(PLANTED, 'planted\n');
      await expect(textOf(PLANTED)).resolves.toBe('planted\n');
    } finally {
      await rm(fromRoot(FOLDER), { force: true, recursive: true });
    }
  });
});
