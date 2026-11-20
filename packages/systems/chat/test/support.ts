/** Inputs and reads the chat kernel's tests share: one builder per input kind, one run, one history read. */

import type { ChatCommand, ChatViewModel } from '#src/system';
import type { FixtureInput, FixtureRun } from '@narratives/foundation/testing';
import { erase, parseTag } from '@narratives/foundation';
import type { ChatMessageVM } from '#src/reduce';
import { chatSystem } from '#src/system';
import { runStream } from '@narratives/foundation/testing';

/** A completed run as the tests read it: its trace, its effects and its view-models. */
interface ChatRun {
  readonly trace: FixtureRun['trace'];
  readonly effects: FixtureRun['effects'];
  readonly viewOf: FixtureRun['viewOf'];
}

/** Options of a story line. */
interface StoryOptions {
  /** Drain the `advance_day` external with the line. */
  readonly advanceDay?: boolean;
}

/**
 * An ink line with its raw tags.
 *
 * @param {string} text - The line's text.
 * @param {readonly string[]} rawTags - Its tags as ink writes them, such as `targetChat: pat`.
 * @param {StoryOptions} options - Whether the line drains the `advance_day` external.
 * @returns {FixtureInput} The story input.
 */
function story(text: string, rawTags: readonly string[] = [], options: StoryOptions = {}): FixtureInput {
  return {
    input: {
      source: 'story',
      step: {
        choices: [],
        externalCalls: options.advanceDay === true ? [{ fn: 'advance_day' }] : [],
        status: 'continue',
        tags: rawTags.map((raw) => parseTag(raw)),
        text,
      },
    },
  };
}

/**
 * The player opens a chat.
 *
 * @param {string} chatId - The chat to open.
 * @returns {FixtureInput} The player input, targeted at chat.
 */
function open(chatId: string): FixtureInput {
  return {
    input: { command: { kind: 'open', payload: { chatId } } satisfies ChatCommand, source: 'player' },
    target: 'chat',
  };
}

/**
 * The player closes the open chat.
 *
 * @returns {FixtureInput} The player input, targeted at chat.
 */
function close(): FixtureInput {
  return {
    input: { command: { kind: 'close', payload: undefined } satisfies ChatCommand, source: 'player' },
    target: 'chat',
  };
}

/**
 * Run a stream through the chat kernel alone, chat in the foreground.
 *
 * @param {readonly FixtureInput[]} inputs - The stream.
 * @returns {Promise<FixtureRun>} The completed run.
 */
async function run(inputs: readonly FixtureInput[]): Promise<FixtureRun> {
  const result = await runStream({ foreground: 'chat', systems: [erase(chatSystem)] }, inputs);
  return result;
}

/**
 * A chat's history after a run.
 *
 * @param {ChatRun} result - The completed run.
 * @param {string} chatId - The chat.
 * @returns {readonly ChatMessageVM[]} Its messages, in order.
 */
function messagesOf(result: ChatRun, chatId: string): readonly ChatMessageVM[] {
  return result.viewOf(chatSystem).messages[chatId] ?? [];
}

/**
 * The texts of a chat's history after a run.
 *
 * @param {ChatRun} result - The completed run.
 * @param {string} chatId - The chat.
 * @returns {readonly string[]} Its messages' texts, in order.
 */
function textsOf(result: ChatRun, chatId: string): readonly string[] {
  return messagesOf(result, chatId).map((message) => message.text);
}

/**
 * What each reduction of a run took in: a story step's text, or the source of any other input.
 *
 * @param {ChatRun} result - The completed run.
 * @returns {readonly string[]} One entry per trace record, in reduction order.
 */
function inputsOf(result: ChatRun): readonly string[] {
  return result.trace.map(({ input }) => (input.source === 'story' ? input.step.text : input.source));
}

/**
 * The read cursors after a run.
 *
 * @param {ChatRun} result - The completed run.
 * @returns {ChatViewModel['lastRead']} The cursor per chat.
 */
function cursorsOf(result: ChatRun): ChatViewModel['lastRead'] {
  return result.viewOf(chatSystem).lastRead;
}

export { close, cursorsOf, inputsOf, messagesOf, open, run, story, textsOf };
export type { ChatRun };
