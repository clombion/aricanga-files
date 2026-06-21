import { Story } from 'inkjs';
import type { StoryChunk } from './story-chunk';

// Thin wrapper over inkjs — the single inkjs touchpoint in the framework
// (foundation/ink). Phase 1 replaces the kernel that consumes these chunks.
export class InkRuntime {
  private readonly story: Story;

  constructor(storyJson: string) {
    this.story = new Story(storyJson);
  }

  /** Advance one line; returns null when the story cannot continue. */
  nextChunk(): StoryChunk | null {
    if (!this.story.canContinue) return null;
    const text = this.story.Continue() ?? '';
    return { text: text.trim(), tags: this.story.currentTags ?? [] };
  }
}
