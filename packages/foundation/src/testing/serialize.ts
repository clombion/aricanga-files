// Canonical serialization for goldens (testing-strategy.md): deep sorted keys so
// the diff is stable across reducer changes that don't change behaviour, and
// `undefined` is normalized to `null` so a present-but-undefined field (e.g. an
// empty `Command.payload` or `fx.persist`) reads consistently across runs.
function canonicalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Serialize to a canonical, sorted-key JSON string for golden snapshots. */
export function canonical(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2);
}
