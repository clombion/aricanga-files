// Sandbox experience — throwaway host for the Phase 0 walking skeleton.
// Exists to prove cross-package type resolution (task-001) and the
// ink → kernel stub → Lit render thread (task-007). The real Aricanga
// experience is ported onto the new stack in Phase 3.

import { FOUNDATION_VERSION } from '@narratives/foundation';
import { CHAT_SYSTEM_ID } from '@narratives/system-chat';

export function bootstrap(): string {
  return `sandbox on foundation ${FOUNDATION_VERSION} with system "${CHAT_SYSTEM_ID}"`;
}

if (typeof document !== 'undefined') {
  const el = document.getElementById('app');
  if (el) el.textContent = bootstrap();
}
