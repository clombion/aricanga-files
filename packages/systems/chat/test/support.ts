/** Inputs and reads the chat kernel's tests share: one builder per input kind, one run, one history read. */

import { erase, parseTag } from '@narratives/foundation';
import { runStream } from '@narratives/foundation/testing';
import type { FixtureInput, FixtureRun } from '@narratives/foundation/testing';

import type { ChatMessageVM } from '../src/reduce';
import { chatSystem } from '../src/system';
import type { ChatCommand } from '../src/system';

/** An ink line with its raw tags; `advanceDay` drains the `advance_day` external with it. */
export function story(text: string, rawTags: readonly string[] = [], options: { readonly advanceDay?: boolean } = {}): FixtureInput {
  return {
    input: {
      source: 'story',
      step: {
        choices: [],
        externalCalls: options.advanceDay === true ? [{ fn: 'advance_day' }] : [],
        status: 'continue',
        tags: rawTags.map(parseTag),
        text,
      },
    },
  };
}

/** The player opens a chat. */
export function open(chatId: string): FixtureInput {
  return {
    input: { command: { kind: 'open', payload: { chatId } } satisfies ChatCommand, source: 'player' },
    target: 'chat',
  };
}

/** The player closes the open chat. */
export function close(): FixtureInput {
  return {
    input: { command: { kind: 'close', payload: undefined } satisfies ChatCommand, source: 'player' },
    target: 'chat',
  };
}

/** Run a stream through the chat kernel alone, chat in the foreground. */
export async function run(inputs: readonly FixtureInput[]): Promise<FixtureRun> {
  return runStream({ foreground: 'chat', systems: [erase(chatSystem)] }, inputs);
}

/** A chat's history after a run. */
export function messagesOf(result: FixtureRun, chatId: string): readonly ChatMessageVM[] {
  return result.viewOf(chatSystem).messages[chatId] ?? [];
}
