import type { Effect } from '../sim/effect';

export type EffectHandler = (payload: unknown) => void;

export interface EffectExecutor {
  execute(effect: Effect): void;
}

// Maps effect kind → handler. An unknown kind is a typed error, never a silent
// no-op (task-009). Foundation + the active system contribute the handler map.
export function createEffectExecutor(
  handlers: Readonly<Record<string, EffectHandler>>,
): EffectExecutor {
  return {
    execute(effect) {
      const handler = handlers[effect.kind];
      if (handler === undefined) {
        throw new Error(`No handler registered for effect kind "${effect.kind}"`);
      }
      handler(effect.payload);
    },
  };
}
