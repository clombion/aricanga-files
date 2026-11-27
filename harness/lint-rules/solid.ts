/**
 * The names of `solid-js` the rules read, each typed by Solid's own declarations: `tsc` refuses a
 * name Solid does not export, so a release that renames one fails the type-check. The root manifest
 * installs `solid-js` for this type; the rules never load it.
 */

// oxlint-disable-next-line import/no-namespace -- the type reads every export's name: no named import can say "any of them"
import type * as Solid from 'solid-js';
import { Accepted } from '#lint-rules/exemptions.ts';

/** A value export of `solid-js`, as its type declarations name them. */
type SolidExport = keyof typeof Solid;

/** The primitives that run an effect. */
const EFFECTS: Accepted<SolidExport> = new Accepted<SolidExport>(['createEffect', 'createRenderEffect']);
/** The primitives that make a signal or a store. */
const SIGNALS: Accepted<SolidExport> = new Accepted<SolidExport>(['createSignal', 'createStore']);
/** The store primitives the snapshot adapter owns. */
const OWNED: Accepted<SolidExport> = new Accepted<SolidExport>(['createStore', 'reconcile']);
/** The async boundary component. */
const LOADING: SolidExport = 'Loading';

export { EFFECTS, LOADING, OWNED, SIGNALS };
