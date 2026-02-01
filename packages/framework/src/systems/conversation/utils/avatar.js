/**
 * Signal-inspired avatar utility.
 * Deterministic color from name hash, curated HSL palette, same-hue adaptive contrast.
 */

// Curated HSL palette — hue + saturation pairs.
// Ordered for maximum hue distance between adjacent indices so that
// nearby hash values still produce visually distinct colors.
const AVATAR_PALETTE = [
  { h: 210, s: 50 }, // blue
  { h: 30, s: 50 }, // orange        (+180)
  { h: 140, s: 45 }, // green        (+110)
  { h: 330, s: 42 }, // pink         (+190)
  { h: 50, s: 45 }, // yellow        (+80)
  { h: 270, s: 40 }, // purple       (+220)
  { h: 10, s: 48 }, // vermilion     (+100)
  { h: 195, s: 45 }, // cyan         (+185)
  { h: 350, s: 45 }, // red          (+155)
  { h: 100, s: 38 }, // olive-green  (+110)
  { h: 290, s: 38 }, // violet       (+190)
  { h: 175, s: 40 }, // teal         (+245)
  { h: 240, s: 42 }, // indigo       (+65)
  { h: 160, s: 38 }, // sea-green    (+280)
];

// Named color map — config-friendly enum for manual avatar color selection.
// Each name maps to a palette-style { h, s } entry.
const NAMED_COLORS = {
  blue: { h: 210, s: 50 },
  orange: { h: 30, s: 50 },
  green: { h: 140, s: 45 },
  pink: { h: 330, s: 42 },
  yellow: { h: 50, s: 45 },
  purple: { h: 270, s: 40 },
  vermilion: { h: 10, s: 48 },
  cyan: { h: 195, s: 45 },
  red: { h: 350, s: 45 },
  olive: { h: 100, s: 38 },
  violet: { h: 290, s: 38 },
  teal: { h: 175, s: 40 },
  indigo: { h: 240, s: 42 },
  gray: { h: 0, s: 0 },
};

// Background lightness: lighter circle
const BG_LIGHTNESS = 80;
// Foreground lightness: darker same-hue initials
const FG_LIGHTNESS = 25;

/**
 * Deterministic hash (djb2) → non-negative integer.
 * @param {string} name
 * @returns {number}
 */
export function hashName(name) {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Pick palette entry deterministically from a name.
 * @param {string} name
 * @returns {{ h: number, s: number }}
 */
export function avatarColorForName(name) {
  return AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length];
}

/**
 * Convert a { h, s } pair into bg/fg CSS color strings.
 * @param {{ h: number, s: number }} hs
 * @returns {{ bg: string, fg: string }}
 */
function hsToCss({ h, s }) {
  return {
    bg: `hsl(${h}, ${s}%, ${BG_LIGHTNESS}%)`,
    fg: `hsl(${h}, ${s}%, ${FG_LIGHTNESS}%)`,
  };
}

/**
 * CSS color strings for avatar background and foreground.
 * Same-hue adaptive contrast: lighter background with darker same-hue text.
 * @param {string} name
 * @returns {{ bg: string, fg: string }}
 */
export function avatarColors(name) {
  return hsToCss(avatarColorForName(name));
}

/**
 * Resolve a named color to bg/fg CSS strings.
 * @param {string} colorName - One of the NAMED_COLORS keys
 * @returns {{ bg: string, fg: string } | null} null if name not recognized
 */
export function namedColorToCss(colorName) {
  const entry = NAMED_COLORS[colorName];
  return entry ? hsToCss(entry) : null;
}

/**
 * Extract initials: first letter of first word + first letter of last word.
 * Single-word names produce one letter.
 * @param {string} name
 * @returns {string} 1-2 uppercase characters
 */
export function avatarInitials(name) {
  // Filter to words starting with a letter (skip parentheticals like "(Editor)")
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w));
  if (parts.length <= 1) return parts[0]?.charAt(0).toUpperCase() || '?';
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Render avatar HTML. Shared across all conversation components.
 *
 * Color resolution order:
 * 1. avatarColorName → named enum (e.g., "purple", "gray")
 * 2. avatarColor → raw CSS color (legacy)
 * 3. Derive from title via hash
 *
 * Display: avatarImage → image, otherwise initials
 *
 * @param {Object} chat - Chat config or notification object
 * @param {string} [chat.title] - Display name (seed for color + initials)
 * @param {string} [chat.avatarImage] - Image path relative to assets/
 * @param {string} [chat.avatarColorName] - Named color enum (e.g., "purple", "gray")
 * @param {string} [chat.avatarColor] - Raw CSS color override (legacy, prefer avatarColorName)
 * @param {string} [chat.avatarLetter] - Manual initials override
 * @param {Object} [options]
 * @param {string} [options.cssClass='avatar'] - CSS class for wrapper
 * @returns {string} HTML string
 */
export function renderAvatar(chat, options = {}) {
  const cssClass = options.cssClass ?? 'avatar';

  // Resolve colors: named enum > raw CSS override > hash-derived
  const name = chat.title || chat.avatarLetter || '?';
  const colors =
    (chat.avatarColorName && namedColorToCss(chat.avatarColorName)) ||
    (chat.avatarColor && { bg: chat.avatarColor, fg: avatarColors(name).fg }) ||
    avatarColors(name);

  if (chat.avatarImage) {
    return `<div class="${cssClass} avatar-image" style="background:${colors.bg};color:${colors.fg}" aria-hidden="true">
      <img src="assets/${chat.avatarImage}" alt="" />
    </div>`;
  }

  const initials = chat.avatarLetter || avatarInitials(name);

  return `<div class="${cssClass}" style="background:${colors.bg};color:${colors.fg}" aria-hidden="true">${initials}</div>`;
}
