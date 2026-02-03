#!/usr/bin/env node
/**
 * Build Config - Generates config.js from TOML configuration
 *
 * This script:
 * 1. Parses experiences/{impl}/data/base-config.toml
 * 2. Parses experiences/{impl}/data/locales/{lang}.toml
 * 3. Merges them and validates
 * 4. Generates experiences/{impl}/src/generated/config.js
 * 5. Generates experiences/{impl}/css/generated/theme-vars.css
 *
 * Usage:
 *   IMPL=<name> node utils/build/build-config.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed output during build
 *
 * Environment:
 *   IMPL                REQUIRED - Implementation name (e.g., 'my-story')
 *   LOCALE              Build specific locale (default: from base-config.toml)
 *   ANALYTICS_ENABLED   Override analytics.enabled (true/false)
 *   ANALYTICS_ENDPOINT  Override analytics.endpoint (URL string)
 *
 * Examples:
 *   IMPL=my-story node utils/build/build-config.js
 *   IMPL=my-story LOCALE=fr node utils/build/build-config.js
 *
 * Exit codes:
 *   0 - Build successful
 *   1 - Build failed (validation errors, missing files, missing IMPL)
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import TOML from '@iarna/toml';
import { getPaths, getProjectRoot } from '../lib/locale-config.js';

// Parse CLI arguments
const ARGS = {
  help: process.argv.includes('--help') || process.argv.includes('-h'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
};

/**
 * Print help message and exit
 */
function showHelp() {
  console.log(`
build-config.js - Generate config.js and theme-vars.css from TOML

USAGE
  IMPL=<name> node utils/build/build-config.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed output during build

ENVIRONMENT
  IMPL                REQUIRED - Implementation name (e.g., 'my-story')
  LOCALE              Build specific locale (overrides default_locale from config)
  ANALYTICS_ENABLED   Override analytics.enabled ('true' or 'false')
  ANALYTICS_ENDPOINT  Override analytics.endpoint (URL string)

OUTPUTS
  experiences/{impl}/src/generated/config.js             JavaScript config module
  experiences/{impl}/css/generated/theme-vars.css    CSS custom properties
  experiences/{impl}/src/dist/locales/{locale}.json      Runtime locale strings

WORKFLOW
  1. Reads experiences/{impl}/data/base-config.toml
  2. Reads experiences/{impl}/data/locales/{locale}.toml
  3. Deep-merges locale into base config
  4. Validates required fields and references
  5. Generates output files

EXIT CODES
  0  Build successful
  1  Build failed (validation errors, missing files, missing IMPL)

EXAMPLES
  IMPL=my-story node utils/build/build-config.js
  IMPL=my-story node utils/build/build-config.js -v
  IMPL=my-story LOCALE=fr node utils/build/build-config.js
`);
  process.exit(0);
}

// Show help if requested
if (ARGS.help) {
  showHelp();
}

// Get implementation name from IMPL env var (required)
const IMPL = process.env.IMPL;
const PROJECT_ROOT = getProjectRoot();

// Validate IMPL is provided
if (!IMPL) {
  console.error(`
Error: IMPL environment variable is required.

Usage: IMPL=<name> node utils/build/build-config.js

Available implementations:`);

  const implDir = join(PROJECT_ROOT, 'experiences');
  try {
    const entries = existsSync(implDir)
      ? readdirSync(implDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [];
    if (entries.length > 0) {
      entries.forEach((name) => console.error(`  - ${name}`));
    } else {
      console.error('  (none found - run mise start to create one)');
    }
  } catch {
    console.error('  (unable to list)');
  }
  console.error('');
  process.exit(1);
}

// Config paths (from centralized definitions)
const paths = getPaths(IMPL);
const IMPL_DIR = paths.implDir;
const IMPL_DATA_DIR = paths.dataDir;
const BASE_CONFIG_PATH = paths.baseConfigPath;
const LOCALES_DIR = paths.localesDir;
const OUTPUT_PATH = paths.configOutput;
const CSS_OUTPUT_PATH = paths.themeVarsOutput;
const LOCALES_OUTPUT_DIR = paths.localesOutputDir;

// Validate implementation exists
if (!existsSync(BASE_CONFIG_PATH)) {
  console.error(`
Error: Implementation "${IMPL}" not found.

Expected config at: ${BASE_CONFIG_PATH}

If you renamed your project folder, update IMPL in mise.toml to match.
Otherwise, run 'mise start' to create a new implementation.

See docs/getting-started.md#troubleshooting for help.
`);
  process.exit(1);
}

// Required fields for each character in base config (technical fields)
const REQUIRED_BASE_CHARACTER_FIELDS = ['knot_name', 'chat_type'];

// Required fields for each character in locale (translatable fields)
const REQUIRED_LOCALE_CHARACTER_FIELDS = ['display_name'];

// Required fields for each chat type in base config
const REQUIRED_BASE_CHAT_TYPE_FIELDS = ['can_send'];

// Required fields for each chat type in locale
const REQUIRED_LOCALE_CHAT_TYPE_FIELDS = ['system_message'];

/**
 * Deep merge two objects, with source overriding target
 * @param {object} target - Base object
 * @param {object} source - Object to merge in
 * @returns {object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Load configuration from split TOML files (base + locale)
 * @param {string} locale - Locale code (e.g., 'en', 'fr')
 * @returns {object} Merged configuration
 */
function loadConfig(locale) {
  // Check if using new split config or legacy single file
  if (existsSync(BASE_CONFIG_PATH)) {
    if (ARGS.verbose) console.log(`  Loading base config: ${BASE_CONFIG_PATH}`);
    const baseContent = readFileSync(BASE_CONFIG_PATH, 'utf-8');
    const baseConfig = TOML.parse(baseContent);

    // Determine locale to load
    const targetLocale = locale || baseConfig.i18n?.default_locale || 'en';
    const localePath = join(LOCALES_DIR, `${targetLocale}.toml`);

    if (!existsSync(localePath)) {
      throw new Error(`Locale file not found: ${localePath}`);
    }

    if (ARGS.verbose) console.log(`  Loading locale: ${localePath}`);
    const localeContent = readFileSync(localePath, 'utf-8');
    const localeConfig = TOML.parse(localeContent);

    // Merge: locale overrides/extends base
    const merged = deepMerge(baseConfig, localeConfig);
    merged._locale = targetLocale; // Track which locale was loaded
    merged._availableLocales = baseConfig.i18n?.available_locales || [
      targetLocale,
    ];

    if (ARGS.verbose) {
      console.log(
        `  Merged config sections: ${Object.keys(merged).join(', ')}`,
      );
    }

    return merged;
  }

  throw new Error(
    `Configuration file not found. Set IMPL env var (e.g., IMPL=my-story)`,
  );
}

/**
 * Generate a consistent avatar color from a name using HSL
 * @param {string} name - Character name to hash
 * @returns {string} HSL color string
 */
// Signal-inspired curated palette — must stay in sync with utils/avatar.js
const AVATAR_PALETTE = [
  { h: 210, s: 50 }, // blue
  { h: 30, s: 50 }, // orange
  { h: 140, s: 45 }, // green
  { h: 330, s: 42 }, // pink
  { h: 50, s: 45 }, // yellow
  { h: 270, s: 40 }, // purple
  { h: 10, s: 48 }, // vermilion
  { h: 195, s: 45 }, // cyan
  { h: 350, s: 45 }, // red
  { h: 100, s: 38 }, // olive-green
  { h: 290, s: 38 }, // violet
  { h: 175, s: 40 }, // teal
  { h: 240, s: 42 }, // indigo
  { h: 160, s: 38 }, // sea-green
];
const BG_LIGHTNESS = 80;

function generateAvatarInitials(name) {
  // Filter to words starting with a letter (skip parentheticals like "(Editor)")
  const parts = name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (parts.length <= 1) return parts[0]?.charAt(0).toUpperCase() || '?';
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function generateAvatarColor(name) {
  // djb2 hash — must match utils/avatar.js hashName()
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  const { h, s } = AVATAR_PALETTE[idx];
  return `hsl(${h}, ${s}%, ${BG_LIGHTNESS}%)`;
}

/**
 * Generate CSS theme variables from TOML config
 * @param {object} config - Parsed TOML config
 * @returns {string} CSS content
 */
function generateThemeCSS(config) {
  const colors = config.ui?.colors || {};
  const opacity = colors.opacity || {};
  const glass = colors.glass || {};

  // Default color values (matches existing theme.css)
  const defaults = {
    bg: '#121216',
    surface: '#1e1e24',
    header: '#1a1a20',
    accent: '#5b7cfa',
    accent_hover: '#4a6ae8',
    success: '#5dd879',
    danger: '#f87171',
    text: '#e8e8ed',
    text_muted: '#71717a',
    text_secondary: '#a1a1aa',
    bubble_sent_bg: '#3b5998',
    bubble_sent_text: '#ffffff',
    bubble_received_bg: '#262630',
    bubble_received_text: '#e8e8ed',
    highlight: '#0ea5e9',
    highlight_hover: '#0284c7',
  };

  // Map TOML keys to CSS variable names
  const colorMap = {
    bg: '--ink-color-bg',
    surface: '--ink-color-surface',
    header: '--ink-color-header',
    accent: '--ink-color-accent',
    accent_hover: '--ink-color-accent-hover',
    success: '--ink-color-success',
    danger: '--ink-color-danger',
    text: '--ink-color-text',
    text_muted: '--ink-color-text-muted',
    text_secondary: '--ink-color-text-secondary',
    bubble_sent_bg: '--ink-bubble-sent-bg',
    bubble_sent_text: '--ink-bubble-sent-text',
    bubble_received_bg: '--ink-bubble-received-bg',
    bubble_received_text: '--ink-bubble-received-text',
    highlight: '--ink-highlight',
    highlight_hover: '--ink-highlight-hover',
  };

  let css = `/* Generated from base-config.toml - Do not edit directly */
/* Run: mise run build:config */

:root {
  /* === PALETTE === */
`;

  // Generate solid color variables
  for (const [tomlKey, cssVar] of Object.entries(colorMap)) {
    const value = colors[tomlKey] || defaults[tomlKey];
    css += `  ${cssVar}: ${value};\n`;
  }

  // Generate opacity variants
  const overlayOpacity = (opacity.overlay ?? 60) / 100;
  const overlayHeavyOpacity = (opacity.overlay_heavy ?? 95) / 100;
  const surfaceGlassOpacity = (opacity.surface_glass ?? 95) / 100;
  const borderSubtleOpacity = (opacity.border_subtle ?? 8) / 100;
  const borderNormalOpacity = (opacity.border_normal ?? 20) / 100;
  const hoverLightOpacity = (opacity.hover_light ?? 10) / 100;
  const hoverMediumOpacity = (opacity.hover_medium ?? 15) / 100;
  const shadowOpacity = (opacity.shadow ?? 40) / 100;

  // Glass effect defaults (notification drawer tiles/cards)
  const tileBg = glass.tile_bg || 'rgba(60, 60, 60, 0.7)';
  const tileHover = glass.tile_hover || 'rgba(80, 80, 80, 0.9)';
  const cardBg = glass.card_bg || 'rgba(60, 60, 60, 0.9)';
  const cardHover = glass.card_hover || 'rgba(80, 80, 80, 0.9)';
  const barBg = glass.bar_bg || 'rgba(20, 20, 20, 0.5)';

  css += `
  /* === OPACITY VARIANTS === */
  --ink-overlay: rgba(0, 0, 0, ${overlayOpacity});
  --ink-overlay-heavy: rgba(0, 0, 0, ${overlayHeavyOpacity});
  --ink-surface-glass: rgba(30, 30, 30, ${surfaceGlassOpacity});
  --ink-border-subtle: rgba(255, 255, 255, ${borderSubtleOpacity});
  --ink-border-normal: rgba(255, 255, 255, ${borderNormalOpacity});
  --ink-hover-light: rgba(255, 255, 255, ${hoverLightOpacity});
  --ink-hover-medium: rgba(255, 255, 255, ${hoverMediumOpacity});
  --ink-shadow: rgba(0, 0, 0, ${shadowOpacity});

  /* === GLASS EFFECTS (notification drawer tiles/cards) === */
  --ink-tile-bg: ${tileBg};
  --ink-tile-hover: ${tileHover};
  --ink-card-bg: ${cardBg};
  --ink-card-hover: ${cardHover};
  --ink-bar-bg: ${barBg};
}
`;

  return css;
}

/**
 * Validate the merged TOML config
 * @param {object} config - Merged TOML object (base + locale)
 * @returns {string[]} Array of validation errors (empty if valid)
 */
function validateConfig(config) {
  const errors = [];

  // Check required top-level sections
  if (!config.game) {
    errors.push('Missing [game] section');
  }
  if (!config.start_state) {
    errors.push('Missing [start_state] section');
  }
  if (!config.chat_types || Object.keys(config.chat_types).length === 0) {
    errors.push('Missing [chat_types] section or no chat types defined');
  }
  if (!config.characters || Object.keys(config.characters).length === 0) {
    errors.push('Missing [characters] section or no characters defined');
  }

  // Validate each chat type (merged fields from base + locale)
  if (config.chat_types) {
    for (const [typeId, typeConfig] of Object.entries(config.chat_types)) {
      // Check base config fields
      for (const field of REQUIRED_BASE_CHAT_TYPE_FIELDS) {
        if (!(field in typeConfig)) {
          errors.push(`Chat type "${typeId}" missing required field: ${field}`);
        }
      }
      // Check locale fields
      for (const field of REQUIRED_LOCALE_CHAT_TYPE_FIELDS) {
        if (!(field in typeConfig)) {
          errors.push(
            `Chat type "${typeId}" missing required locale field: ${field}`,
          );
        }
      }
    }
  }

  // Validate each character (merged fields from base + locale)
  if (config.characters) {
    for (const [id, char] of Object.entries(config.characters)) {
      // Check base config fields
      for (const field of REQUIRED_BASE_CHARACTER_FIELDS) {
        if (!(field in char)) {
          errors.push(`Character "${id}" missing required field: ${field}`);
        }
      }
      // Check locale fields
      for (const field of REQUIRED_LOCALE_CHARACTER_FIELDS) {
        if (!(field in char)) {
          errors.push(
            `Character "${id}" missing required locale field: ${field}`,
          );
        }
      }

      // Validate knot_name convention
      if (char.knot_name && !char.knot_name.endsWith('_chat')) {
        errors.push(
          `Character "${id}" knot_name should end with "_chat" (got: ${char.knot_name})`,
        );
      }

      // Validate avatar_color_name is a known enum (if provided)
      const VALID_COLOR_NAMES = [
        'blue', 'orange', 'green', 'pink', 'yellow', 'purple', 'vermilion',
        'cyan', 'red', 'olive', 'violet', 'teal', 'indigo', 'gray',
      ];
      if (char.avatar_color_name && !VALID_COLOR_NAMES.includes(char.avatar_color_name)) {
        errors.push(
          `Character "${id}" avatar_color_name must be one of: ${VALID_COLOR_NAMES.join(', ')} (got: ${char.avatar_color_name})`,
        );
      }

      // Validate avatar_color is hex (if provided)
      if (char.avatar_color && !/^#[0-9a-fA-F]{6}$/.test(char.avatar_color)) {
        errors.push(
          `Character "${id}" avatar_color must be hex format (got: ${char.avatar_color})`,
        );
      }

      // Validate avatar_image exists (if provided)
      if (char.avatar_image) {
        const imagePath = join(IMPL_DIR, 'public', 'assets', char.avatar_image);
        if (!existsSync(imagePath)) {
          errors.push(
            `Character "${id}" avatar_image not found: ${char.avatar_image}`,
          );
        }
      }

      // Validate status length against constraint (strip glossary markup before measuring)
      const statusMaxLen = config.ui?.constraints?.hub?.character_status;
      const statusDisplayLen = char.status
        ? char.status.replace(/\(\(([^:]+)::[^)]+\)\)/g, '$1').length
        : 0;
      if (char.status && statusMaxLen && statusDisplayLen > statusMaxLen) {
        errors.push(
          `Character "${id}" status exceeds ${statusMaxLen} chars (got: ${statusDisplayLen})`,
        );
      }

      // Validate chat_type references valid type
      if (
        char.chat_type &&
        config.chat_types &&
        !(char.chat_type in config.chat_types)
      ) {
        errors.push(
          `Character "${id}" references unknown chat_type: ${char.chat_type}`,
        );
      }

      // Validate disappearing chats have required duration
      if (char.chat_type === 'disappearing' && !char.disappearing_duration) {
        errors.push(
          `Character "${id}" with chat_type "disappearing" requires disappearing_duration`,
        );
      }
    }
  }

  // Validate ui.colors if present
  if (config.ui?.colors) {
    const colors = config.ui.colors;
    for (const [key, value] of Object.entries(colors)) {
      if (key === 'opacity' || key === 'glass') continue; // Skip nested objects
      if (typeof value === 'string' && !/^#[0-9a-fA-F]{6}$/.test(value)) {
        errors.push(`ui.colors.${key} must be hex format (got: ${value})`);
      }
    }

    // Validate opacity values
    if (colors.opacity) {
      for (const [key, value] of Object.entries(colors.opacity)) {
        if (typeof value !== 'number' || value < 0 || value > 100) {
          errors.push(`ui.colors.opacity.${key} must be 0-100 (got: ${value})`);
        }
      }
    }
  }

  return errors;
}

/**
 * Serialize a value to JavaScript object literal syntax (not JSON)
 * - Unquoted keys for valid identifiers
 * - Single quotes for strings
 * - Trailing commas
 * @param {*} value - Value to serialize
 * @param {number} indent - Current indentation level
 * @returns {string} JavaScript literal string
 */
function toJSLiteral(value, indent = 0) {
  const spaces = '  '.repeat(indent);
  const nextSpaces = '  '.repeat(indent + 1);

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);

  if (typeof value === 'string') {
    // Escape single quotes and use single-quoted strings
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `'${escaped}'`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(
      (v) => `${nextSpaces}${toJSLiteral(v, indent + 1)}`,
    );
    return `[\n${items.join(',\n')},\n${spaces}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';

    const entries = keys.map((key) => {
      // Use unquoted key if valid identifier, otherwise quote it
      const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
      const formattedKey = validIdentifier ? key : `'${key}'`;
      return `${nextSpaces}${formattedKey}: ${toJSLiteral(value[key], indent + 1)}`;
    });
    return `{\n${entries.join(',\n')},\n${spaces}}`;
  }

  return String(value);
}

/**
 * Convert TOML config to JavaScript config.js content
 * @param {object} config - Parsed and validated TOML object
 * @returns {string} JavaScript module content
 */
function generateConfigJS(config) {
  // Transform chat_types to CHAT_TYPES format
  const chatTypes = {};
  for (const [typeId, typeConfig] of Object.entries(config.chat_types)) {
    chatTypes[typeId] = {
      canSend: typeConfig.can_send,
      systemMessage: typeConfig.system_message,
      ...(typeConfig.input_placeholder && {
        inputPlaceholder: typeConfig.input_placeholder,
      }),
    };
  }

  // Transform characters to CHATS format (matching existing config.js structure)
  const chats = {};
  for (const [id, char] of Object.entries(config.characters)) {
    // Auto-derive avatar values if not provided
    const avatarLetter =
      char.avatar_letter || generateAvatarInitials(char.display_name);
    const avatarColorName = char.avatar_color_name || null;
    const avatarColor =
      char.avatar_color || generateAvatarColor(char.display_name);
    const avatarImage = char.avatar_image || null;

    chats[id] = {
      title: char.display_name,
      knotName: char.knot_name,
      defaultPresence: char.default_presence || null,
      avatarLetter,
      ...(avatarColorName && { avatarColorName }),
      avatarColor,
      avatarImage,
      pinned: char.pinned || false,
      description: char.description || '',
      chatType: char.chat_type || 'normal',
      // Optional: disappearing duration (for disappearing chat type)
      ...(char.disappearing_duration && {
        disappearingDuration: char.disappearing_duration,
      }),
      // Optional: per-chat system message override
      ...(char.system_message && {
        systemMessage: char.system_message,
      }),
      // Status/bio text (optional, shown on profile page)
      ...(char.status && { status: char.status }),
      // Narrative metadata (optional, for consistency review)
      ...(char.personality && { personality: char.personality }),
      ...(char.story_role && { storyRole: char.story_role }),
      ...(char.knowledge && { knowledge: char.knowledge }),
    };
  }

  // Build APP config
  const app = config.app || {};
  const appName = app.name || 'Civichat';

  // Resolve profile images: directory > array > single (mutually exclusive)
  let profileImages = [];
  const profileImageDir = app.profile_image_dir;
  if (profileImageDir) {
    const absDir = join(IMPL_DIR, 'public', 'assets', profileImageDir);
    if (!existsSync(absDir)) {
      throw new Error(`profile_image_dir not found: ${absDir}`);
    }
    profileImages = readdirSync(absDir)
      .filter(f => /\.(jpg|png|webp)$/i.test(f))
      .sort()
      .map(f => `${profileImageDir}/${f}`);
    if (profileImages.length === 0) {
      console.warn(`Warning: profile_image_dir "${profileImageDir}" is empty`);
    }
  } else if (app.profile_images) {
    profileImages = app.profile_images;
  } else if (app.profile_image) {
    profileImages = [app.profile_image];
  }

  const appConfig = {
    name: appName,
    gameTitle: app.game_title || 'Capital Chronicle',
    ...(profileImages.length > 0 && { profileImages }),
    ...(app.player_status && { playerStatus: app.player_status }),
    ...(app.player_email && { playerEmail: app.player_email }),
  };

  // Build UI config
  const ui = config.ui || {};
  const uiConfig = {
    timings: {
      notificationAutoHide: ui.timings?.notification_auto_hide || 5000,
      notificationStagger: ui.timings?.notification_stagger || 1500,
      autoSaveInterval: ui.timings?.auto_save_interval || 30000,
      messageGroupThreshold: ui.timings?.message_group_threshold || 60000,
      focusDelay: ui.timings?.focus_delay || 100,
    },
    dimensions: {
      imageMaxWidth: ui.dimensions?.image_max_width || 240,
    },
    strings: {
      resetDialogTitle: ui.strings?.reset_dialog_title || 'SYSTEM RESET',
      resetDialogMessage:
        ui.strings?.reset_dialog_message ||
        'This will wipe all story progress and reset the timeline.\n\nAre you sure?',
      noNotifications: ui.strings?.no_notifications || 'No new notifications',
      tapToOpen: ui.strings?.tap_to_open || 'Tap to open',
    },
  };

  // Build i18n config
  const i18nConfig = {
    locale: config._locale || 'en',
    availableLocales: config._availableLocales || ['en'],
    localeNames: config.i18n?.locale_names || { en: 'English' },
  };

  // Build STRINGS export from ui section (for i18n module)
  const strings = config.ui || {};

  // Generate the JavaScript module
  const js = `// Generated from experiences/{impl}/data/base-config.toml + locales/${config._locale || 'en'}.toml
// Do not edit directly - run: mise run build:config

// Game metadata
export const GAME = ${toJSLiteral(config.game)};

// Initial state
export const START_STATE = ${toJSLiteral(config.start_state)};

// Phone hardware and behavior
export const PHONE = ${toJSLiteral(config.phone || {})};

// Analytics configuration
export const ANALYTICS = ${toJSLiteral(config.analytics || { enabled: false, endpoint: '', retention: { max_age_days: 7, max_entries: 5000 } })};

// App branding
export const APP = ${toJSLiteral(appConfig)};

// Internationalization config
export const I18N = ${toJSLiteral(i18nConfig)};

// UI configuration (timings, dimensions, strings)
export const UI = ${toJSLiteral(uiConfig)};

// All translatable strings (for i18n module)
export const STRINGS = ${toJSLiteral(strings)};

// Chat types - define behavioral types with default system messages
export const CHAT_TYPES = ${toJSLiteral(chatTypes)};

// Chat registry - single source of truth for chat configuration
export const CHATS = ${toJSLiteral(chats)};

// External functions that ink can call
export const EXTERNAL_FUNCTIONS = ['delay_next', 'play_sound', 'name'];

// Helper to get chat IDs
export const CHAT_IDS = Object.keys(CHATS);

// Message types (ink # type: tag values)
export const MESSAGE_TYPES = {
  SENT: 'sent',
  RECEIVED: 'received',
  SYSTEM: 'system',
  ATTACHMENT: 'attachment',
};

// Game events emitted by controller
export const GAME_EVENTS = {
  READY: 'ready',
  MESSAGE_ADDED: 'message-added',
  CHOICES_AVAILABLE: 'choices-available',
  CHAT_OPENED: 'chat-opened',
  NOTIFICATION: 'notification',
  TYPING_START: 'typing-start',
  TYPING_END: 'typing-end',
};
`;

  return js;
}

/**
 * Flatten nested entity structure for simple ID-based lookups
 * e.g., entities.companies.aricanga → aricanga
 * @param {object} entities - Nested entities object
 * @returns {object} Flattened { id: { name, short, alt, ... } }
 */
function flattenEntities(entities) {
  const flat = {};
  for (const category of Object.values(entities || {})) {
    for (const [id, data] of Object.entries(category)) {
      flat[id] = { ...data };
    }
  }
  return flat;
}

/**
 * Extract name variants from characters config
 * @param {object} characters - Characters object
 * @returns {object} { charId: { first_name, last_name, formal, ... } }
 */
function extractCharacterNames(characters) {
  const names = {};
  const nameFields = ['first_name', 'last_name', 'formal', 'display_name'];

  for (const [id, char] of Object.entries(characters || {})) {
    const charNames = {};
    for (const field of nameFields) {
      if (char[field]) {
        charNames[field] = char[field];
      }
    }
    if (Object.keys(charNames).length > 0) {
      names[id] = charNames;
    }
  }
  return names;
}

/**
 * Generate locale JSON file for runtime loading
 * Includes UI strings and name data for i18n.getName()
 * @param {string} locale - Locale code
 * @param {object} baseConfig - Base config for entity/character names
 * @returns {object} Locale data object with ui strings, names, baseNames
 */
function generateLocaleJSON(locale, baseConfig) {
  const localePath = join(LOCALES_DIR, `${locale}.toml`);
  if (!existsSync(localePath)) {
    throw new Error(`Locale file not found: ${localePath}`);
  }

  const content = readFileSync(localePath, 'utf-8');
  const localeConfig = TOML.parse(content);

  // Extract UI strings (everything under ui.*)
  const result = { ...(localeConfig.ui || {}) };

  // Merge glossary terms (glossary.terms.*) with UI glossary strings
  if (localeConfig.glossary) {
    result.glossary = { ...(result.glossary || {}), ...localeConfig.glossary };
  }

  // Build baseNames from base config (entities + characters)
  const entityNames = flattenEntities(baseConfig.entities);
  const characterNames = extractCharacterNames(baseConfig.characters);
  result.baseNames = { ...entityNames, ...characterNames };

  // Add locale-specific name overrides if present
  // Structure: names.characters.activist.formal = "Mme Santos"
  //            names.entities.aricanga.name = "Société Minière"
  if (localeConfig.names) {
    const localeNames = {};

    // Flatten character name overrides
    if (localeConfig.names.characters) {
      for (const [id, data] of Object.entries(localeConfig.names.characters)) {
        localeNames[id] = { ...data };
      }
    }

    // Flatten entity name overrides
    if (localeConfig.names.entities) {
      for (const [id, data] of Object.entries(localeConfig.names.entities)) {
        localeNames[id] = { ...(localeNames[id] || {}), ...data };
      }
    }

    if (Object.keys(localeNames).length > 0) {
      result.names = localeNames;
    }
  }

  return result;
}

// Main execution
try {
  console.log('Building config from TOML...');
  if (ARGS.verbose) console.log('');

  // Get locale from env or use default
  const locale = process.env.LOCALE || null;
  if (ARGS.verbose && locale) {
    console.log(`  LOCALE env override: ${locale}`);
  }

  // Load and merge config (base + locale)
  const config = loadConfig(locale);

  // Apply env var overrides for analytics
  if (process.env.ANALYTICS_ENABLED !== undefined) {
    config.analytics = config.analytics || {};
    config.analytics.enabled = process.env.ANALYTICS_ENABLED === 'true';
    if (ARGS.verbose) {
      console.log(`  ANALYTICS_ENABLED override: ${config.analytics.enabled}`);
    }
  }
  if (process.env.ANALYTICS_ENDPOINT !== undefined) {
    config.analytics = config.analytics || {};
    config.analytics.endpoint = process.env.ANALYTICS_ENDPOINT;
    if (ARGS.verbose) {
      console.log(`  ANALYTICS_ENDPOINT override: ${config.analytics.endpoint}`);
    }
  }

  // Validate merged config
  if (ARGS.verbose) console.log('\nValidating config...');
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error('Validation errors:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  if (ARGS.verbose) console.log('  Validation passed');

  // Inject build identifier (YYYYMMDD.shortSHA)
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    config.game.buildId = `${date}.${sha}`;
  } catch {
    config.game.buildId = 'dev';
  }

  // Generate JavaScript
  if (ARGS.verbose) console.log('\nGenerating outputs...');
  const jsContent = generateConfigJS(config);

  // Generate CSS theme variables
  const cssContent = generateThemeCSS(config);

  // Ensure output directories exist
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  mkdirSync(dirname(CSS_OUTPUT_PATH), { recursive: true });
  mkdirSync(LOCALES_OUTPUT_DIR, { recursive: true });

  // Write outputs
  writeFileSync(OUTPUT_PATH, jsContent, 'utf-8');
  writeFileSync(CSS_OUTPUT_PATH, cssContent, 'utf-8');

  // Format generated JS with biome (if available)
  try {
    execSync(`npx biome format --write ${OUTPUT_PATH}`, { stdio: 'pipe' });
    if (ARGS.verbose) console.log('  Formatted config.js with biome');
  } catch (_e) {
    // biome not available, skip formatting
  }

  // Generate locale JSON files for all available locales (runtime loading)
  // Pass base config (with entities/characters) for name resolution
  const availableLocales = config._availableLocales || ['en'];
  for (const loc of availableLocales) {
    const localeStrings = generateLocaleJSON(loc, config);
    const localeOutputPath = join(LOCALES_OUTPUT_DIR, `${loc}.json`);
    writeFileSync(
      localeOutputPath,
      JSON.stringify(localeStrings, null, 2),
      'utf-8',
    );
    if (ARGS.verbose) console.log(`  Generated: ${localeOutputPath}`);
  }

  if (ARGS.verbose) {
    console.log(`  Generated: ${OUTPUT_PATH}`);
    console.log(`  Generated: ${CSS_OUTPUT_PATH}`);
    console.log('');
  }

  // Summary
  console.log(`✓ Config built successfully`);
  console.log(`  Locale: ${config._locale || 'en'}`);
  console.log(`  Available locales: ${availableLocales.join(', ')}`);
  console.log(`  Characters: ${Object.keys(config.characters).length}`);
  if (ARGS.verbose) {
    console.log(`  Chat types: ${Object.keys(config.chat_types || {}).length}`);
    console.log(
      `  Theme colors: ${Object.keys(config.ui?.colors || {}).length}`,
    );
  }
} catch (error) {
  console.error('Build failed:', error.message);
  if (ARGS.verbose && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
