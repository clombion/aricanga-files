// Sandbox experience — throwaway host for the Phase 0 walking skeleton.
// Proves cross-package type resolution (task-001), the Vite pipeline (task-002),
// and the Lit baseline (task-003). The ink → kernel stub → Lit render thread is
// task-007. The real Aricanga experience is ported onto the new stack in Phase 3.

import { FOUNDATION_VERSION } from '@narratives/foundation';
import { CHAT_SYSTEM_ID } from '@narratives/system-chat';
import { SkMessage } from './sk-message';

export function bootstrap(): string {
  return `sandbox on foundation ${FOUNDATION_VERSION} with system "${CHAT_SYSTEM_ID}"`;
}

if (typeof document !== 'undefined') {
  const host = document.getElementById('app');
  if (host) {
    const msg = new SkMessage();
    msg.text = bootstrap();
    host.replaceChildren(msg);
  }
}
