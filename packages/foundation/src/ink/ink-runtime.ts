import { Story } from 'inkjs';
import { parseTag } from '../sim/story';
import type { Choice, ExternalCall, InkStatus, InkStep, Tag } from '../sim/story';

// Host-owned wrapper over inkjs — the single inkjs touchpoint (ADR-0007). The
// runtime owns this; the kernel never reads ink. `name`/`data` are resolved into
// the line text host-side (via injected fixtures); the four drain-class externals
// are captured into `InkStep.externalCalls`, and `request_data` flips the step to
// `await-data` so the pump suspends until `Resume(DataArrived)`.
/** @public */
export type NameResolver = (id: string) => string;
/** @public */
export type DataResolver = (key: string) => string;

/** @public */
export interface InkFixtures {
  readonly name?: NameResolver;
  readonly data?: DataResolver;
}

/** An ink value as text: ink passes externals strings, numbers and booleans, never objects. */
function inkText(value: unknown): string {
  if (typeof value === 'string') {return value;}
  if (typeof value === 'number' || typeof value === 'boolean') {return `${value}`;}
  throw new TypeError(`ink passed an external a ${typeof value}, not a primitive`);
}

/** An ink value as a number. */
function inkNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(inkText(value));
}

/** The ink externals the runtime binds: the two lookups and every external call it drains. */
type InkExternal = 'name' | 'data' | ExternalCall['fn'];

export class InkRuntime {
  private readonly story: Story;
  private drained: ExternalCall[] = [];
  private awaitingData = false;

  constructor(storyJson: string, fixtures: InkFixtures = {}) {
    this.story = new Story(storyJson);
    this.bindExternals(fixtures);
  }

  private bindExternals(fixtures: InkFixtures): void {
    // ink hands an external its arguments untyped, so each handler takes `unknown` and converts.
    const bind = (name: InkExternal, fn: (...args: unknown[]) => unknown): void => {
      // A story that doesn't declare the external simply never calls it; binding
      // an undeclared name is harmless. Guard so a missing declaration can't throw.
      try {
        this.story.BindExternalFunction(name, fn, false);
      } catch {
        // not declared in this story — nothing to bind
      }
    };

    const resolveName: NameResolver = fixtures.name ?? ((id) => id);
    const resolveData: DataResolver = fixtures.data ?? ((key) => key);
    bind('name', (id) => resolveName(inkText(id)));
    bind('data', (key) => resolveData(inkText(key)));

    bind('delay_next', (seconds) => {
      this.drained.push({ fn: 'delay_next', seconds: inkNumber(seconds) });
    });
    bind('play_sound', (sound) => {
      this.drained.push({ fn: 'play_sound', sound: inkText(sound) });
    });
    bind('advance_day', () => {
      this.drained.push({ fn: 'advance_day' });
    });
    bind('request_data', (source, query, params) => {
      const call: ExternalCall =
        params === undefined
          ? { fn: 'request_data', query: inkText(query), source: inkText(source) }
          : { fn: 'request_data', params: inkText(params), query: inkText(query), source: inkText(source) };
      this.drained.push(call);
      this.awaitingData = true;
      return '';
    });
  }

  canContinue(): boolean {
    return this.story.canContinue;
  }

  /** Advance one line and drain the side-channel into an InkStep. */
  continue(): InkStep {
    this.drained = [];
    this.awaitingData = false;
    const text = (this.story.Continue() ?? '').trim();
    const tags: readonly Tag[] = (this.story.currentTags ?? []).map(parseTag);
    const status = this.computeStatus();
    return {
      choices: status === 'await-choice' ? this.currentChoices() : [],
      externalCalls: this.drained,
      status,
      tags,
      text,
    };
  }

  private computeStatus(): InkStatus {
    if (this.awaitingData) {return 'await-data';}
    if (this.story.canContinue) {return 'continue';}
    if (this.story.currentChoices.length > 0) {return 'await-choice';}
    return 'end';
  }

  private currentChoices(): readonly Choice[] {
    return this.story.currentChoices.map((c) => ({
      index: c.index ?? 0,
      tags: (c.tags ?? []).map(parseTag),
      text: c.text ?? '',
    }));
  }

  choose(index: number): void {
    this.story.ChooseChoiceIndex(index);
  }

  toJson(): string {
    return this.story.state.ToJson();
  }

  loadJson(json: string): void {
    this.story.state.LoadJson(json);
  }
}
