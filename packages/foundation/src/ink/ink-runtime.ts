import { Story } from 'inkjs';
import {
  type Choice,
  type ExternalCall,
  type InkStatus,
  type InkStep,
  type Tag,
  parseTag,
} from '../sim/story';

// Host-owned wrapper over inkjs — the single inkjs touchpoint (ADR-0007). The
// runtime owns this; the kernel never reads ink. `name`/`data` are resolved into
// the line text host-side (via injected fixtures); the four drain-class externals
// are captured into `InkStep.externalCalls`, and `request_data` flips the step to
// `await-data` so the pump suspends until `Resume(DataArrived)`.
export type NameResolver = (id: string) => string;
export type DataResolver = (key: string) => string;

export interface InkFixtures {
  readonly name?: NameResolver;
  readonly data?: DataResolver;
}

export class InkRuntime {
  private readonly story: Story;
  private drained: ExternalCall[] = [];
  private awaitingData = false;

  constructor(storyJson: string, fixtures: InkFixtures = {}) {
    this.story = new Story(storyJson);
    this.bindExternals(fixtures);
  }

  private bindExternals(fixtures: InkFixtures): void {
    const bind = (name: string, fn: (...args: never[]) => unknown): void => {
      // A story that doesn't declare the external simply never calls it; binding
      // an undeclared name is harmless. Guard so a missing declaration can't throw.
      try {
        this.story.BindExternalFunction(name, fn as (...args: unknown[]) => unknown, false);
      } catch {
        // not declared in this story — nothing to bind
      }
    };

    const resolveName: NameResolver = fixtures.name ?? ((id) => id);
    const resolveData: DataResolver = fixtures.data ?? ((key) => key);
    bind('name', (id: string) => resolveName(String(id)));
    bind('data', (key: string) => resolveData(String(key)));

    bind('delay_next', (seconds: number) => {
      this.drained.push({ fn: 'delay_next', seconds: Number(seconds) });
    });
    bind('play_sound', (sound: string) => {
      this.drained.push({ fn: 'play_sound', sound: String(sound) });
    });
    bind('advance_day', () => {
      this.drained.push({ fn: 'advance_day' });
    });
    bind('request_data', (source: string, query: string, params?: string) => {
      const call: ExternalCall =
        params === undefined
          ? { fn: 'request_data', source: String(source), query: String(query) }
          : { fn: 'request_data', source: String(source), query: String(query), params: String(params) };
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
      text,
      tags,
      choices: status === 'await-choice' ? this.currentChoices() : [],
      externalCalls: this.drained,
      status,
    };
  }

  private computeStatus(): InkStatus {
    if (this.awaitingData) return 'await-data';
    if (this.story.canContinue) return 'continue';
    if (this.story.currentChoices.length > 0) return 'await-choice';
    return 'end';
  }

  private currentChoices(): readonly Choice[] {
    return this.story.currentChoices.map((c) => ({
      index: c.index ?? 0,
      text: c.text ?? '',
      tags: (c.tags ?? []).map(parseTag),
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
