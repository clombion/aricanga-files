// Number formatting utilities for human-readable display
// Uses Intl.NumberFormat for locale-aware currency and number formatting

import { i18n } from './i18n.js';

/**
 * Format currency values with locale-aware symbols and scale words
 * Uses compact notation for large numbers (e.g., "$180M" or "180 M $")
 * @param {number} value - Raw value in smallest currency unit
 * @param {string} [currency='USD'] - ISO 4217 currency code
 * @returns {string} Formatted string like "$180M" (en) or "180 M $US" (fr)
 */
export function formatCurrency(value, currency = 'USD') {
  const locale = i18n.locale;

  // Use compact notation for large numbers (handles billion/million automatically)
  if (Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  // Standard currency format for smaller values
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number with locale-aware separators
 * @param {number} value - Number to format
 * @returns {string} Formatted number (e.g., "1,234,567" or "1 234 567")
 */
export function formatNumber(value) {
  return new Intl.NumberFormat(i18n.locale).format(value);
}

/**
 * Format a percentage with locale-aware formatting
 * @param {number} value - Decimal value (e.g., 0.75 for 75%)
 * @param {number} [decimals=0] - Number of decimal places
 * @returns {string} Formatted percentage (e.g., "75%" or "75 %")
 */
export function formatPercent(value, decimals = 0) {
  return new Intl.NumberFormat(i18n.locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
