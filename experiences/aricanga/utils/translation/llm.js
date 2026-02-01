/**
 * llm.js - Provider-agnostic LLM integration for translation
 *
 * Uses Vercel AI SDK for unified access to multiple LLM providers.
 * Provider configuration is loaded from llm-providers.toml.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import TOML from '@iarna/toml';
import { generateObject } from 'ai';
import { z } from 'zod';

import { validateHighlights, validatePlaceholders } from '../../../../utils/lib/ink-writer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * SDK factory functions for each provider
 */
const PROVIDER_FACTORIES = {
  anthropic,
  google,
  openai,
  fake: null,
};

/**
 * Zod schema for structured translation output
 */
const TranslationResultSchema = z.object({
  translations: z.array(
    z.object({
      id: z.string(),
      translation: z.string(),
    }),
  ),
});

/**
 * Load provider configuration from TOML file
 */
function loadProviderConfig() {
  const configPath = join(__dirname, 'llm-providers.toml');
  const content = readFileSync(configPath, 'utf-8');
  const config = TOML.parse(content);

  const providers = {};
  for (const [name, settings] of Object.entries(config)) {
    providers[name] = {
      factory: PROVIDER_FACTORIES[name],
      defaultModel: settings.default_model,
      envKey: settings.env_key || null,
      isFake: name === 'fake',
    };
  }
  return providers;
}

/**
 * Available LLM providers and their default models
 */
const PROVIDERS = loadProviderConfig();

/**
 * Get a provider instance
 */
export function getProvider(providerName, modelOverride) {
  const provider = PROVIDERS[providerName];

  if (!provider) {
    const available = Object.keys(PROVIDERS).join(', ');
    throw new Error(
      `Unknown provider: ${providerName}. Available: ${available}`,
    );
  }

  // Fake provider doesn't need API key or factory
  if (provider.isFake) {
    return { isFake: true, model: modelOverride || provider.defaultModel };
  }

  // Check for API key
  if (!process.env[provider.envKey]) {
    throw new Error(
      `Missing API key: Set ${provider.envKey} environment variable`,
    );
  }

  const model = modelOverride || provider.defaultModel;
  return provider.factory(model);
}

/**
 * Build system prompt for translation
 * @param {string} targetLang - Target language name
 * @param {Object} batchContext - Context for this batch (glossary, characters, etc.)
 */
export function buildSystemPrompt(targetLang, batchContext = {}) {
  let prompt = `You are a professional translator. Translate the provided strings from English to ${targetLang}.

CRITICAL RULES:
1. Preserve {variable} placeholders EXACTLY as written
2. Preserve ((text::source)) learning markers EXACTLY as written
3. Translate naturally for the target language
4. Maintain the tone and register of the original`;

  // Add glossary if present
  if (batchContext.glossary?.length > 0) {
    prompt += '\n\nGLOSSARY - Handle these terms as specified:';
    for (const term of batchContext.glossary) {
      if (term.action === 'preserve') {
        prompt += `\n- "${term.term}": Preserve unchanged (${term.note || 'proper noun'})`;
      } else if (term.action === 'translate_as' && term[batchContext.targetLocale?.code]) {
        prompt += `\n- "${term.term}": Translate as "${term[batchContext.targetLocale.code]}"`;
      }
    }
  }

  // Add character voices if present
  if (batchContext.characters && Object.keys(batchContext.characters).length > 0) {
    prompt += '\n\nCHARACTER VOICES - Match speaking style when speaker is indicated:';
    for (const [name, voice] of Object.entries(batchContext.characters)) {
      prompt += `\n- ${name}: ${voice}`;
    }
  }

  // Add UI constraints if present
  if (batchContext.constraints && Object.keys(batchContext.constraints).length > 0) {
    prompt += '\n\nUI CONSTRAINTS (max character lengths):';
    for (const [element, maxLen] of Object.entries(batchContext.constraints)) {
      prompt += `\n- ${element}: ${maxLen} characters max`;
    }
    prompt += '\n\nEnsure translations respect these limits where possible.';
  }

  return prompt;
}

/**
 * Build translation prompt with items and enriched context
 * @param {Array} items - Translation units with context
 */
export function buildTranslationPrompt(items) {
  const enriched = items.map((item) => {
    const entry = {
      id: item.id,
      source: item.source,
    };

    // Include speaker info if available
    if (item.speaker) {
      entry.speaker = item.speaker;
    }

    // Include preceding lines for context
    if (item.preceding?.length > 0) {
      entry.preceding = item.preceding;
    }

    // Include scene description if present
    if (item.scene) {
      entry.scene = item.scene;
    }

    // Include speaker voice description if available
    if (item.speakerVoice) {
      entry.speakerVoice = item.speakerVoice;
    }

    // Include basic context (knot, stitch) as fallback
    if (item.context && !item.speaker && !item.scene) {
      entry.context = item.context;
    }

    return entry;
  });

  return `Translate these strings:

${JSON.stringify({ items: enriched }, null, 2)}`;
}


/**
 * Validate that translation preserves required elements from source
 * Uses ink-writer validators which correctly exclude ink flow keywords
 * Returns array of validation errors (empty if valid)
 */
export function validateTranslation(source, translation) {
  const errors = [];

  if (!source) return errors;
  if (!translation) {
    if (source.trim()) {
      errors.push({
        type: 'empty_translation',
        message: 'Translation is empty',
      });
    }
    return errors;
  }

  // Check placeholders using ink-writer's validator (excludes flow keywords)
  const placeholderResult = validatePlaceholders(source, translation);
  if (!placeholderResult.valid) {
    if (placeholderResult.missing) {
      for (const p of placeholderResult.missing) {
        errors.push({
          type: 'missing_placeholder',
          message: `Missing placeholder: ${p}`,
          expected: p,
        });
      }
    }
    if (placeholderResult.extra) {
      for (const p of placeholderResult.extra) {
        errors.push({
          type: 'extra_placeholder',
          message: `Unexpected placeholder: ${p}`,
          found: p,
        });
      }
    }
  }

  // Check learning markers using ink-writer's validator
  const highlightResult = validateHighlights(source, translation);
  if (!highlightResult.valid) {
    errors.push({
      type: 'missing_marker',
      message: highlightResult.error,
    });
  }

  return errors;
}

/**
 * Extract {placeholder} patterns from text, excluding ink flow keywords
 * Used internally by fakeTranslate
 */
function extractPlaceholders(text) {
  if (!text) return [];
  const placeholderRegex = /\{(\w+)\}/g;
  const flowKeywords = ['not', 'and', 'or', 'true', 'false'];
  const matches = [];
  let match;
  while ((match = placeholderRegex.exec(text)) !== null) {
    if (!flowKeywords.includes(match[1])) {
      matches.push(match[0]);
    }
  }
  return [...new Set(matches)];
}

/**
 * Extract ((learning::markers)) patterns from text
 * Used internally by fakeTranslate
 */
function extractLearningMarkers(text) {
  if (!text) return [];
  const matches = text.match(/\(\([^)]+::[^)]+\)\)/g);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Fake translation - simulates realistic LLM behavior for testing
 * Preserves placeholders and learning markers while transforming text
 */
export function fakeTranslate(items, targetLang) {
  // Extract locale code from language name (e.g., "Français" -> "fr")
  const localeMap = {
    français: 'fr',
    french: 'fr',
    español: 'es',
    spanish: 'es',
    deutsch: 'de',
    german: 'de',
    italiano: 'it',
    italian: 'it',
  };
  const locale =
    localeMap[targetLang.toLowerCase()] || targetLang.slice(0, 2).toLowerCase();

  return items.map((item) => {
    const source = item.source || '';

    // Handle empty strings
    if (!source.trim()) {
      return { id: item.id, translation: source };
    }

    // Extract elements to preserve (excludes ink flow keywords)
    const placeholders = extractPlaceholders(source);
    const markers = extractLearningMarkers(source);

    // Replace placeholders/markers with tokens, transform text, restore
    let text = source;
    const preserved = [];

    // Temporarily replace placeholders
    for (let i = 0; i < placeholders.length; i++) {
      const token = `__PH${i}__`;
      preserved.push({ token, value: placeholders[i] });
      text = text.replace(placeholders[i], token);
    }

    // Temporarily replace markers
    for (let i = 0; i < markers.length; i++) {
      const token = `__MK${i}__`;
      preserved.push({ token, value: markers[i] });
      text = text.replace(markers[i], token);
    }

    // Simulate translation by adding locale prefix to each "word" segment
    // This transforms the text while preserving structure
    text = text
      .split(/(\s+)/)
      .map((segment) => {
        // Don't transform whitespace or tokens
        if (/^\s*$/.test(segment) || /^__(?:PH|MK)\d+__$/.test(segment)) {
          return segment;
        }
        // Add locale marker to actual words
        return `${segment}[${locale}]`;
      })
      .join('');

    // Restore preserved elements
    for (const { token, value } of preserved) {
      text = text.replace(token, value);
    }

    return { id: item.id, translation: text };
  });
}

/**
 * Translate strings using LLM with structured output
 * @param {string} providerName - LLM provider name
 * @param {Array} items - Translation units to translate
 * @param {string} targetLang - Target language name
 * @param {string} modelOverride - Optional model override
 * @param {Object} batchContext - Context for this batch (glossary, characters, targetLocale)
 */
export async function translate(
  providerName,
  items,
  targetLang,
  modelOverride,
  batchContext = {},
) {
  const provider = getProvider(providerName, modelOverride);

  // Use fake implementation for testing
  if (provider.isFake) {
    return fakeTranslate(items, targetLang);
  }

  // Collect unique constraints from items
  const constraints = {};
  for (const item of items) {
    if (item.constraints?.uiElement && item.constraints?.maxLength) {
      constraints[item.constraints.uiElement] = item.constraints.maxLength;
    }
  }

  // Merge constraints into batchContext
  const fullContext = {
    ...batchContext,
    constraints,
  };

  const { object } = await generateObject({
    model: provider,
    schema: TranslationResultSchema,
    system: buildSystemPrompt(targetLang, fullContext),
    prompt: buildTranslationPrompt(items),
  });

  return object.translations;
}

/**
 * Get available provider names
 */
export function getAvailableProviders() {
  return Object.keys(PROVIDERS);
}

/**
 * Check if a provider has API key configured
 */
export function isProviderConfigured(providerName) {
  const provider = PROVIDERS[providerName];
  if (!provider) return false;
  // Fake provider is always "configured"
  if (provider.isFake) return true;
  return !!process.env[provider.envKey];
}

/**
 * Get the environment variable key for a provider
 */
export function getProviderEnvKey(providerName) {
  const provider = PROVIDERS[providerName];
  return provider?.envKey || null;
}

/**
 * Get provider configuration (for use by other modules)
 */
export function getProviderConfig(providerName) {
  return PROVIDERS[providerName] || null;
}
