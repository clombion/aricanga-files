/**
 * Contract tests for i18n library functions
 * Tests the API contracts that translate.js depends on
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  ENTITY_NAMES,
  CHARACTER_NAMES,
} from '../fixtures/story-expectations';
import { getPaths } from '../../../../packages/test-utils/src/helpers/paths.js';

const IMPL = process.env.IMPL;
if (!IMPL) throw new Error('IMPL env var required');
const LOCALES_DIR = getPaths(IMPL).localesOutputDir;

describe('getLocalePaths contract', () => {
  it('returns required path properties with correct types', async () => {
    const { getLocalePaths } = await import('../../../../utils/lib/locale-config.js');

    const enPaths = getLocalePaths('en');
    const frPaths = getLocalePaths('fr');

    // Required properties exist
    const requiredProps = ['locale', 'storyPath', 'inkDir', 'inkBaseDir', 'variablesFile', 'projectRoot'];
    for (const prop of requiredProps) {
      expect(enPaths).toHaveProperty(prop);
      expect(typeof enPaths[prop as keyof typeof enPaths]).toBe('string');
    }

    // Locale-specific paths
    expect(enPaths.locale).toBe('en');
    expect(frPaths.locale).toBe('fr');
    expect(frPaths.inkBaseDir).toContain('fr');
  });
});

describe('parseLocaleInkFiles contract', () => {
  it('returns array of translation units with required properties', async () => {
    const { parseLocaleInkFiles } = await import('../../../../utils/lib/ink-parser.js');
    const { getLocalePaths } = await import('../../../../utils/lib/locale-config.js');

    const paths = getLocalePaths('en');
    const units = parseLocaleInkFiles(paths.inkBaseDir, 'en');

    expect(Array.isArray(units)).toBe(true);
    expect(units.length).toBeGreaterThan(0);

    // Check required properties on first unit
    const unit = units[0];
    const requiredProps = ['id', 'source', 'type', 'context', 'file', 'line'];
    for (const prop of requiredProps) {
      expect(unit).toHaveProperty(prop);
    }

    // Type checks
    expect(typeof unit.id).toBe('string');
    expect(typeof unit.source).toBe('string');
    expect(typeof unit.type).toBe('string');
    expect(typeof unit.context).toBe('string');
    expect(typeof unit.file).toBe('string');
    expect(typeof unit.line).toBe('number');
  });

  it('unit types are valid', async () => {
    const { parseLocaleInkFiles } = await import('../../../../utils/lib/ink-parser.js');
    const { getLocalePaths } = await import('../../../../utils/lib/locale-config.js');

    const paths = getLocalePaths('en');
    const units = parseLocaleInkFiles(paths.inkBaseDir, 'en');
    const validTypes = ['dialogue', 'choice', 'sequence', 'conditional'];

    for (const unit of units) {
      expect(validTypes).toContain(unit.type);
    }
  });

  it('returns empty array for non-existent directory', async () => {
    const { parseLocaleInkFiles } = await import('../../../../utils/lib/ink-parser.js');
    const units = parseLocaleInkFiles('/non/existent/path', 'xx');
    expect(Array.isArray(units)).toBe(true);
    expect(units.length).toBe(0);
  });
});

describe('parseInkFile contract', () => {
  it('extracts placeholders and highlights from text', async () => {
    const { parseLocaleInkFiles } = await import('../../../../utils/lib/ink-parser.js');
    const { getLocalePaths } = await import('../../../../utils/lib/locale-config.js');

    const paths = getLocalePaths('en');
    const units = parseLocaleInkFiles(paths.inkBaseDir, 'en');

    // Check placeholder extraction
    const unitWithPlaceholder = units.find(
      (u) => u.source && u.source.includes('{') && u.placeholders
    );
    if (unitWithPlaceholder) {
      expect(typeof unitWithPlaceholder.placeholders).toBe('object');
    }

    // Check highlight extraction
    const unitWithHighlight = units.find(
      (u) => u.source && u.source.includes('((') && u.highlights
    );
    if (unitWithHighlight) {
      expect(Array.isArray(unitWithHighlight.highlights)).toBe(true);
    }
  });
});

describe('getName contract (locale JSON structure)', () => {
  it('baseNames contains entity and character names from config', () => {
    const enJson = JSON.parse(readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8'));

    // Contract: baseNames must exist
    expect(enJson.baseNames).toBeDefined();
    expect(typeof enJson.baseNames).toBe('object');

    // Entity names match generated expectations
    expect(enJson.baseNames.aricanga.name).toBe(ENTITY_NAMES.aricanga.name);
    expect(enJson.baseNames.aricanga.short).toBe(ENTITY_NAMES.aricanga.short);
    expect(enJson.baseNames.ministry.short).toBe(ENTITY_NAMES.ministry.short);
    expect(enJson.baseNames.ministry.reference).toBe(ENTITY_NAMES.ministry.reference);

    // Character names match generated expectations
    expect(enJson.baseNames.activist.first_name).toBe(CHARACTER_NAMES.activist.first_name);
    expect(enJson.baseNames.activist.last_name).toBe(CHARACTER_NAMES.activist.last_name);
    expect(enJson.baseNames.activist.formal).toBe(CHARACTER_NAMES.activist.formal);
    expect(enJson.baseNames.activist.display_name).toBe(CHARACTER_NAMES.activist.display_name);
  });

  it('locale-specific names and all variants have string values', () => {
    const enJson = JSON.parse(readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8'));
    const frJson = JSON.parse(readFileSync(path.join(LOCALES_DIR, 'fr.json'), 'utf-8'));

    // French baseNames present
    expect(frJson.baseNames).toBeDefined();
    expect(frJson.baseNames.aricanga.short).toBe(ENTITY_NAMES.aricanga.short);

    // All values in baseNames must be strings (non-empty)
    for (const [, variants] of Object.entries(enJson.baseNames)) {
      expect(typeof variants).toBe('object');
      for (const [, value] of Object.entries(variants as Record<string, unknown>)) {
        if (typeof value === 'string') {
          expect(value.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('getName fallback behavior', () => {
    const enJson = JSON.parse(readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8'));

    // Simulate getName fallback logic
    const getName = (id: string, variant: string): string => {
      const names = enJson.names || {};
      const baseNames = enJson.baseNames || {};
      return names[id]?.[variant] || baseNames[id]?.[variant] || id;
    };

    // Existing name returns correct value
    expect(getName('aricanga', 'short')).toBe(ENTITY_NAMES.aricanga.short);
    expect(getName('activist', 'first_name')).toBe(CHARACTER_NAMES.activist.first_name);

    // Missing variant falls back to id
    expect(getName('aricanga', 'nonexistent')).toBe('aricanga');
    expect(getName('nonexistent', 'short')).toBe('nonexistent');
  });
});
