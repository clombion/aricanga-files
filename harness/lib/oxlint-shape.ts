/**
 * The gate's oxlint configuration as a type: exactly the fields the builder emits, each typed by
 * oxlint's own type of it and readonly at every depth; every other field of oxlint's configuration
 * is `never`, so a field no check reads (`extends`, an override's `excludeFiles`) cannot be set.
 */

import type { OxlintConfig, OxlintOverride } from 'oxlint';
import type { DeepReadonly } from './readonly.ts';

/** The fields of `Type` beside `Keys`, each refused. */
type NoOther<Type, Keys extends keyof Type> = Readonly<Partial<Record<Exclude<keyof Type, Keys>, never>>>;

/** An override of the gate's configuration: its files and rules, and an environment where it sets one. */
type GateOverride = DeepReadonly<Required<Pick<OxlintOverride, 'files' | 'rules'>> & Pick<OxlintOverride, 'env'>> &
  NoOther<OxlintOverride, 'env' | 'files' | 'rules'>;

/** The fields the gate's configuration sets beside its overrides. */
type Emitted = 'categories' | 'env' | 'ignorePatterns' | 'jsPlugins' | 'options' | 'plugins' | 'rules';

/** The gate's oxlint configuration. */
type GateOxlintConfig = DeepReadonly<Required<Pick<OxlintConfig, Emitted>>> &
  Readonly<{ overrides: readonly GateOverride[] }> &
  NoOther<OxlintConfig, Emitted | 'overrides'>;

/** Any oxlint configuration, read and never written: a planted run's, where oxlint's own schema is the subject. */
type AnyOxlintConfig = DeepReadonly<OxlintConfig>;

export type { AnyOxlintConfig, GateOverride, GateOxlintConfig };
