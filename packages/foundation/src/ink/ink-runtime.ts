import type { Choice, ExternalCall, InkStatus, InkStep, Tag } from '#src/sim/story';
import { Story } from 'inkjs';
import { parseTag } from '#src/sim/story';

/*
 * Host-owned wrapper over inkjs — the single inkjs touchpoint (ADR-0007). The
 * runtime owns this; the kernel never reads ink. `name`/`data` are resolved into
 * the line text host-side (via injected fixtures); the four drain-class externals
 * are captured into `InkStep.externalCalls`, and `request_data` flips the step to
 * `await-data` so the pump suspends until `Resume(DataArrived)`.
 */

/** @public */
type NameResolver = (id: string) => string;

/** @public */
type DataResolver = (key: string) => string;

/** @public */
interface InkFixtures {
  readonly name?: NameResolver;
  readonly data?: DataResolver;
}

/**
 * An ink value as text: ink passes externals strings, numbers and booleans, never objects.
 *
 * @param {unknown} value - The value ink passed.
 * @returns {string} The value as text.
 */
function inkText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`;
  }
  throw new TypeError(`ink passed an external a ${typeof value}, not a primitive`);
}

/**
 * An ink value as a number.
 *
 * @param {unknown} value - The value ink passed.
 * @returns {number} The value as a number.
 */
function inkNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(inkText(value));
}

/**
 * Parse each raw ink tag.
 *
 * @param {readonly string[]} raw - The tags as ink gives them.
 * @returns {readonly Tag[]} The parsed tags.
 */
function parseTags(raw: readonly string[]): readonly Tag[] {
  return raw.map((tag) => parseTag(tag));
}

/** The ink externals the runtime binds: the two lookups and every external call it drains. */
type InkExternal = 'name' | 'data' | ExternalCall['fn'];

/** An external's handler: ink hands it its arguments untyped, so it takes `unknown` and converts. */
type ExternalHandler = (...args: readonly unknown[]) => unknown;

/**
 * The surface of an inkjs story the runtime reads, typed as inkjs declares it: a line, the current
 * tags and a choice's tags may each be `null`.
 */
type InkStory = Pick<Story, 'BindExternalFunction' | 'ChooseChoiceIndex' | 'Continue' | 'canContinue'> & {
  readonly currentTags: ReadonlyTags<Story['currentTags']>;
  readonly currentChoices: readonly InkChoice[];
  readonly state: Readonly<Pick<Story['state'], 'LoadJson' | 'ToJson'>>;
};

/** A tag list as inkjs declares it, read only: its strings, or inkjs's absent value. */
type ReadonlyTags<TTags> = Exclude<TTags, readonly string[]> | Readonly<NonNullable<TTags>>;

/** The fields of an inkjs choice the runtime reads. */
interface InkChoice {
  readonly index: Story['currentChoices'][number]['index'];
  readonly tags: ReadonlyTags<Story['currentChoices'][number]['tags']>;
  readonly text: Story['currentChoices'][number]['text'];
}

/** The ink story a step's lines, tags, choices and externals are read from. */
class InkRuntime {
  private readonly story: Readonly<InkStory>;
  private drained: ExternalCall[] = [];
  private awaitingData = false;

  /**
   * A runtime over a story surface; `InkRuntime.fromJson` builds one from compiled ink.
   *
   * @param {InkStory} story - The inkjs story, or a double of its declared surface.
   * @param {InkFixtures} fixtures - How the `name` and `data` externals resolve.
   */
  public constructor(story: Readonly<InkStory>, fixtures: Readonly<InkFixtures> = {}) {
    this.story = story;
    this.bindExternals(fixtures);
  }

  /**
   * A runtime over a compiled ink story.
   *
   * @param {string} storyJson - The story as inklecate or inkjs's compiler writes it.
   * @param {InkFixtures} fixtures - How the `name` and `data` externals resolve.
   * @returns {InkRuntime} The runtime.
   */
  public static fromJson(storyJson: string, fixtures: Readonly<InkFixtures> = {}): InkRuntime {
    return new InkRuntime(new Story(storyJson), fixtures);
  }

  /**
   * Whether ink has another line to continue to.
   *
   * @returns {boolean} Whether `continue` can advance.
   */
  public canContinue(): boolean {
    return this.story.canContinue;
  }

  /**
   * Advance one line and drain the side-channel into an InkStep.
   *
   * @returns {InkStep} The line, its tags, the choices offered, the externals called and the status.
   */
  public continue(): InkStep {
    this.drained = [];
    this.awaitingData = false;
    const text = (this.story.Continue() ?? '').trim();
    const tags = parseTags(this.story.currentTags ?? []);
    const status = this.computeStatus();
    return {
      choices: status === 'await-choice' ? this.currentChoices() : [],
      externalCalls: this.drained,
      status,
      tags,
      text,
    };
  }

  /**
   * Take the choice at `index`.
   *
   * @param {number} index - The index ink gave the choice.
   */
  public choose(index: number): void {
    this.story.ChooseChoiceIndex(index);
  }

  /**
   * The story's state as ink serialises it.
   *
   * @returns {string} The state's JSON text.
   */
  public toJson(): string {
    return this.story.state.ToJson();
  }

  /**
   * Restore a state `toJson` gave.
   *
   * @param {string} json - The state's JSON text.
   */
  public loadJson(json: string): void {
    this.story.state.LoadJson(json);
  }

  private bindExternals(fixtures: Readonly<InkFixtures>): void {
    const resolveName: NameResolver = fixtures.name ?? ((id) => id);
    const resolveData: DataResolver = fixtures.data ?? ((key) => key);
    this.bind('name', (id) => resolveName(inkText(id)));
    this.bind('data', (key) => resolveData(inkText(key)));
    this.bind('delay_next', (seconds) => {
      this.drained.push({ fn: 'delay_next', seconds: inkNumber(seconds) });
    });
    this.bind('play_sound', (sound) => {
      this.drained.push({ fn: 'play_sound', sound: inkText(sound) });
    });
    this.bind('advance_day', () => {
      this.drained.push({ fn: 'advance_day' });
    });
    // `params` is optional in the story's declaration, so the handler takes it as a rest argument:
    // ink checks a call's arguments against the handler's declared parameters.
    this.bind('request_data', (source, query, ...rest: readonly unknown[]) => {
      const [params] = rest;
      const call: ExternalCall =
        params === undefined
          ? { fn: 'request_data', query: inkText(query), source: inkText(source) }
          : { fn: 'request_data', params: inkText(params), query: inkText(query), source: inkText(source) };
      this.drained.push(call);
      this.awaitingData = true;
      return '';
    });
  }

  private bind(name: InkExternal, handler: ExternalHandler): void {
    /*
     * A story that doesn't declare the external simply never calls it; binding
     * an undeclared name is harmless. Guard so a missing declaration can't throw.
     */
    try {
      this.story.BindExternalFunction(name, handler, false);
    } catch {
      // Not declared in this story — nothing to bind.
    }
  }

  private computeStatus(): InkStatus {
    if (this.awaitingData) {
      return 'await-data';
    }
    if (this.story.canContinue) {
      return 'continue';
    }
    const [offered] = this.story.currentChoices;
    return offered === undefined ? 'end' : 'await-choice';
  }

  private currentChoices(): readonly Choice[] {
    const choices: Choice[] = [];
    for (const choice of this.story.currentChoices) {
      choices.push({ index: choice.index, tags: parseTags(choice.tags ?? []), text: choice.text });
    }
    return choices;
  }
}

export { InkRuntime };
export type { DataResolver, InkFixtures, InkStory, NameResolver };
