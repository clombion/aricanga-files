import type { InkStep } from '@narratives/foundation';

export interface ChatMessageVM {
  readonly id: string;
  readonly chatId: string;
  readonly speaker: string;
  readonly text: string;
}

/** The presentation fields of a message, parsed from an ink step. */
export type MessageFields = Pick<ChatMessageVM, 'speaker' | 'text'>;

// Parse the presentation fields (speaker + text) from an ink step. Identity
// (id + owning chatId) is assembled by `model/route.ts`, which knows the routing.
export function reduceStep(step: InkStep): MessageFields {
  const speaker = step.tags.find((t) => t.key === 'speaker')?.value ?? '';
  return { speaker, text: step.text };
}
