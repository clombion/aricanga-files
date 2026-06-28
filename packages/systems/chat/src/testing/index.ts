// @narratives/system-chat/testing — the chat physics invariants as pure predicates
// over the observable stream (task-018). Tasks 020–025 import these as their green
// acceptance target. Lives in the chat package because the predicates read chat
// state types that foundation cannot import.

export {
  routingOwnership,
  notifyOnce,
  seedExclusion,
  hwmMonotonic,
  forwardOnlyTime,
  receiptMonotonic,
} from './predicates';
