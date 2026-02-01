// Game State Machine - Aricanga implementation
// Thin wrapper around the conversation system factory

import {
  createConversationMachine,
  parseTags,
  timeContext,
} from '@narratives/framework';
import { CHAT_IDS } from './config.js';

/**
 * Aricanga-specific stall handler for debugging
 * Logs when story stops unexpectedly with high visit counts
 */
function onStall({ path, visits, turn, hint }) {
  console.warn('[aricanga] Story stall detected:', {
    path,
    visits,
    turn,
    hint,
    suggestion:
      'Check ink file for missing diverts or infinite loops near this path',
  });
}

/**
 * Create the Aricanga game state machine
 * Uses the conversation system factory with implementation-specific config
 */
export const gameStateMachine = createConversationMachine({
  machineId: 'game',
  parseTags,
  processMessageTime: timeContext.processMessageTime.bind(timeContext),
  knownChatIds: CHAT_IDS,
  onStall,
});
