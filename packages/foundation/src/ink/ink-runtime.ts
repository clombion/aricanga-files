import { Story } from 'inkjs';
import { type StoryChunk, parseTag } from '../sim/story';

// Thin wrapper over inkjs — the single inkjs touchpoint in the framework
// (foundation/ink). Produces vocabulary-agnostic StoryChunks for the kernel.
export class InkRuntime {
  private readonly story: Story;

  constructor(storyJson: string) {
    this.story = new Story(storyJson);
  }

  /** Advance one line, or surface a choice point; null when the story ends. */
  nextChunk(): StoryChunk | null {
    if (this.story.canContinue) {
      const text = this.story.Continue() ?? '';
      const tags = (this.story.currentTags ?? []).map(parseTag);
      return { text: text.trim(), tags, choices: [], isChoicePoint: false };
    }
    const choices = this.story.currentChoices;
    if (choices.length > 0) {
      return {
        text: '',
        tags: [],
        choices: choices.map((c) => ({
          index: c.index ?? 0,
          text: c.text ?? '',
          tags: (c.tags ?? []).map(parseTag),
        })),
        isChoicePoint: true,
      };
    }
    return null;
  }

  /** Select a choice at a choice point, then continue with nextChunk(). */
  choose(index: number): void {
    this.story.ChooseChoiceIndex(index);
  }
}
