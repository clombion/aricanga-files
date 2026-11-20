/** The project rules that hold closed sets: read whole, and read through their own entries. */

import type { Rule } from '#lint-rules/ast.ts';
import { ownKeys } from '#lint-rules/rules/own-keys.ts';
import { totalReads } from '#lint-rules/rules/total-reads.ts';

export const CLOSED_RULES: Readonly<Record<string, Rule>> = {
  'own-keys': ownKeys,
  'total-reads': totalReads,
};
