/**
 * icons.js - Shared SVG icon factories
 *
 * Centralises inline SVG strings used across multiple components.
 */

export function backIcon(size = 24) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <polyline points="15 18 9 12 15 6"/>
</svg>`;
}

export function timerIcon(size = 24, { withAlarm = false } = {}) {
  const alarm = withAlarm
    ? `\n  <line x1="4" y1="4" x2="8" y2="8" stroke-width="2.5"/>`
    : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <circle cx="12" cy="12" r="10"/>
  <polyline points="12 6 12 12 16 14"/>${alarm}
</svg>`;
}
