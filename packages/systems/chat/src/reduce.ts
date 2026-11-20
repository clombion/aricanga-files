import type { InkStep } from '@narratives/foundation';

interface ChatMessageVM {
  readonly id: string;
  readonly chatId: string;
  readonly speaker: string;
  readonly text: string;
  /**
   * The simulation time the message arrived, in absolute minutes (day * 1440 + minute of day).
   * Absent when it arrived before any time was anchored (the view renders a date separator).
   */
  readonly time?: number;
}

/** The presentation fields of a message, parsed from an ink step. */
type MessageFields = Pick<ChatMessageVM, 'speaker' | 'text'>;

/**
 * Parse the presentation fields (speaker and text) from an ink step. Identity (id and owning
 * chatId) is assembled by `model/route.ts`, which knows the routing.
 *
 * @param {InkStep} step - The ink step a message comes from.
 * @returns {MessageFields} Its speaker, empty when untagged, and its text.
 */
function reduceStep(step: InkStep): MessageFields {
  const speaker = step.tags.find((tag) => tag.key === 'speaker')?.value ?? '';
  return { speaker, text: step.text };
}

export { reduceStep };
export type { ChatMessageVM };
