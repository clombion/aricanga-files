/**
 * No current text uses a retired term or a refused pattern of `docs/terms.toml`.
 *
 * A retired term is matched as a whole word, in any case, in prose outside code spans: a span
 * quoting the old name is a quotation. A refused pattern is matched in prose and in code spans; a
 * pattern refused in code is matched in the comments of code only. Each retired term names the
 * term that replaced it.
 */

import * as TOML from '@iarna/toml';
import { describe, expect, test } from 'vitest';

import { object } from '../lib/config.ts';
import { currentSpans, currentText, type Prose, type Span } from '../lib/docs.ts';
import { Exemptions, Prefixes, site } from '../lib/exemptions.ts';
import { textOf } from '../lib/source-files.ts';

export const HARNESS_ID = 'terms';

/** The current text that is Markdown; every other line of current text is a comment of code. */
const MARKDOWN = new Prefixes(['.md']);

/** Uses of a term in its domain sense, or adopted with their fix, keyed by `site(path, term)`. */
const EXEMPT = Exemptions.grouped({
  'adopting: the sandbox Lit component is replaced by a Solid part (#24)': [
    site("experiences/sandbox/src/main.ts", "Lit"),
    site("experiences/sandbox/src/sk-message.test.ts", "Lit"),
    site("experiences/sandbox/src/sk-message.ts", "Lit"),
    site("experiences/sandbox/src/skeleton.test.ts", "Lit"),
  ],
  'adopting: quote `Lit` in a code span where ADR-0002 compares the alternatives': [
    site("docs/roadmap/decisions/0002-typescript-and-solid.md", "Lit"),
  ],
  'adopting: replace the task id with the issue it became, or drop it; task ids belong in the tracker': [
    site("experiences/sandbox/src/main.ts", "task-007"),
    site("experiences/sandbox/src/sk-message.test.ts", "task-003"),
    site("experiences/sandbox/src/sk-message.test.ts", "task-004"),
    site("experiences/sandbox/src/sk-message.ts", "task-003"),
    site("experiences/sandbox/src/skeleton.test.ts", "task-007"),
    site("experiences/sandbox/src/two-vocabulary.test.ts", "task-015"),
    site("experiences/sandbox/vite.config.ts", "task-007"),
    site("packages/foundation/src/host/runtime.ts", "task-020"),
    site("packages/foundation/src/index.test.ts", "task-004"),
    site("packages/foundation/src/sim/trace.ts", "task-058"),
    site("packages/foundation/src/testing/harness.ts", "task-041"),
    site("packages/foundation/src/testing/index.ts", "task-017"),
    site("packages/foundation/src/testing/property.ts", "task-018"),
    site("packages/systems/chat/src/model/defer.ts", "task-021"),
    site("packages/systems/chat/src/model/defer.ts", "task-032"),
    site("packages/systems/chat/src/model/read-state.ts", "task-021"),
    site("packages/systems/chat/src/model/route.ts", "task-018"),
    site("packages/systems/chat/src/model/time.ts", "task-023"),
    site("packages/systems/chat/src/reduce.test.ts", "task-007"),
    site("packages/systems/chat/src/state.ts", "task-023"),
    site("packages/systems/chat/src/system.ts", "task-020"),
    site("packages/systems/chat/src/system.ts", "task-021"),
    site("packages/systems/chat/src/testing/index.ts", "task-018"),
    site("packages/systems/chat/src/testing/index.ts", "task-019"),
    site("packages/systems/chat/src/testing/predicates.ts", "task-018"),
    site("packages/systems/chat/src/testing/predicates.ts", "task-019"),
    site("packages/systems/chat/src/testing/predicates.ts", "task-020"),
    site("packages/systems/chat/src/testing/predicates.ts", "task-021"),
    site("packages/systems/chat/src/testing/predicates.ts", "task-022"),
    site("packages/systems/chat/src/testing/predicates.ts", "task-023"),
    site("packages/systems/chat/src/testing/predicates.ts", "task-024"),
    site("packages/systems/chat/src/testing/predicates.ts", "task-032"),
    site("packages/systems/chat/test/chat-fixtures.test.ts", "task-017"),
    site("packages/systems/chat/test/regression-ledger.test.ts", "task-021"),
    site("packages/systems/chat/test/regression-ledger.test.ts", "task-032"),
    site("packages/systems/chat/test/regression-ledger.ts", "task-019"),
    site("packages/systems/chat/test/routing.property.test.ts", "task-018"),
    site("packages/systems/chat/test/routing.property.test.ts", "task-020"),
  ],
});

/** The parsed terms file. */
interface Terms {
  readonly retired: ReadonlyMap<string, string>;
  readonly refused: ReadonlyMap<string, string>;
  readonly refusedInCode: ReadonlyMap<string, string>;
}

function strings(table: unknown, what: string): ReadonlyMap<string, string> {
  return new Map(
    Object.entries(object(table ?? {}, what)).map(([name, value]) => {
      if (typeof value !== 'string') {
        throw new TypeError(`${what}.${name} is not a string`);
      }
      return [name, value] as const;
    }),
  );
}

/** Read a parsed terms file, refusing a retired term without its replacement. */
export function termsOf(text: string): Terms {
  const data = object(TOML.parse(text), 'terms');
  const retired = strings(data['retired'], 'retired');
  const blank = [...retired].filter(([, replacement]) => replacement.trim() === '').map(([term]) => term);
  if (blank.length > 0) {
    throw new TypeError(`retired terms without a replacement: ${JSON.stringify(blank)}`);
  }
  return {
    retired,
    refused: strings(data['refused'], 'refused'),
    refusedInCode: strings(data['refused-in-code'], 'refused-in-code'),
  };
}

/** A use of current text the terms file refuses. */
interface Use {
  readonly path: string;
  readonly line: number;
  /** The retired term or the text the refused pattern matched. */
  readonly term: string;
  /** The replacement, or where the refused text belongs. */
  readonly why: string;
}

/** Every use of current text that the terms file refuses. */
export function uses(terms: Terms, prose: readonly Prose[], spans: readonly Span[]): Use[] {
  const found: Use[] = [];
  for (const [term, replacement] of terms.retired) {
    const pattern = new RegExp(String.raw`\b${escaped(term)}\b`, 'i');
    found.push(
      ...prose
        .filter((line) => pattern.test(line.text))
        .map((line) => ({ path: line.path, line: line.line, term, why: `use ${replacement}` })),
    );
  }
  const refusals = [
    ...[...terms.refused].map(([pattern, why]) => [pattern, why, [...prose, ...spans]] as const),
    ...[...terms.refusedInCode].map(
      ([pattern, why]) => [pattern, why, [...prose, ...spans].filter((line) => !MARKDOWN.ends(line.path))] as const,
    ),
  ];
  for (const [pattern, why, lines] of refusals) {
    const regex = new RegExp(pattern, 'g');
    found.push(
      ...lines.flatMap((line) =>
        [...line.text.matchAll(regex)].map((match) => ({ path: line.path, line: line.line, term: match[0], why })),
      ),
    );
  }
  return found;
}

/** A term as a literal regular-expression source. */
function escaped(term: string): string {
  return term.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function key(use: Use): string {
  return site(use.path, use.term);
}

describe('the repository', () => {
  test('no current text uses a refused term', () => {
    const found = uses(termsOf(textOf('docs/terms.toml')), currentText(), currentSpans());
    expect(EXEMPT.unexemptedBy(found, key)).toEqual([]);
  });
});

const PLANTED_TERMS = `[retired]
sentinel = "marker"
[refused]
"TASK-[0-9]+" = "the tracker"
[refused-in-code]
"ticket-[0-9]+" = "the tracker"
`;

describe('the terms check', () => {
  test('sees a planted retired term, refused pattern and code-only pattern, and lets the near misses through', () => {
    const terms = termsOf(PLANTED_TERMS);
    const prose = [
      { path: 'docs/planted.md', line: 1, text: 'A Sentinel value closes TASK-12.' },
      { path: 'docs/planted.md', line: 2, text: 'sentinels and ticket-4 in a doc' },
      { path: 'src/planted.ts', line: 3, text: 'closes ticket-9' },
    ];
    const spans = [
      { path: 'docs/planted.md', line: 4, text: 'TASK-7' },
      { path: 'docs/planted.md', line: 5, text: 'sentinel' },
    ];
    expect(uses(terms, prose, spans)).toEqual([
      { path: 'docs/planted.md', line: 1, term: 'sentinel', why: 'use marker' },
      { path: 'docs/planted.md', line: 1, term: 'TASK-12', why: 'the tracker' },
      { path: 'docs/planted.md', line: 4, term: 'TASK-7', why: 'the tracker' },
      { path: 'src/planted.ts', line: 3, term: 'ticket-9', why: 'the tracker' },
    ]);
  });

  test('refuses a retired term without its replacement', () => {
    expect(() => termsOf('[retired]\nsentinel = " "\n')).toThrow(/without a replacement/);
  });

  test('reads the repository terms file', () => {
    const terms = termsOf(textOf('docs/terms.toml'));
    expect(terms.retired.size + terms.refused.size + terms.refusedInCode.size).toBeGreaterThan(0);
  });
});
