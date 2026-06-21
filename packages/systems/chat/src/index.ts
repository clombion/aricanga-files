// @narratives/system-chat — the chat vocabulary (messages, typing, receipts,
// notifications). Phase 0 carries a stub reduce for the walking skeleton;
// implements the System interface in Phase 1 and the physics kernel in Phase 2.

import { FOUNDATION_VERSION } from '@narratives/foundation';

export const CHAT_SYSTEM_ID = 'chat';

// Proves the system builds against the foundation package boundary.
export const builtAgainstFoundation = FOUNDATION_VERSION;

export { reduceChunk } from './reduce';
export type { ChatMessageVM } from './reduce';
