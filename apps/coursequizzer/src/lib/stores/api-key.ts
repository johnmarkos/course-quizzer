// --- API Key Store ---
// Manages the user's Anthropic API key in localStorage.
// The key is stored as-is — no encryption (localStorage is same-origin).
// This module has no browser dependency at import time; localStorage
// is injected so it's testable without jsdom.

export const API_KEY_STORAGE_KEY = 'coursequizzer:api-key';

const MASK_CHAR = '•';
const LONG_PREFIX_LENGTH = 7; // "sk-ant-" prefix for standard Anthropic keys
const LONG_SUFFIX_LENGTH = 4;
const SHORT_PREFIX_LENGTH = 2;
const SHORT_SUFFIX_LENGTH = 2;
// Keys shorter than this use the short prefix/suffix; longer keys use the standard masking
const SHORT_KEY_THRESHOLD = LONG_PREFIX_LENGTH + LONG_SUFFIX_LENGTH + 1;
// Keys at or below this length are fully masked (no visible chars)
const FULLY_MASKED_THRESHOLD = SHORT_PREFIX_LENGTH + SHORT_SUFFIX_LENGTH;

/**
 * Save an API key to localStorage.
 * Trims whitespace. Throws if the key is empty or whitespace-only.
 */
export function saveApiKey(key: string, storage: Storage): void {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    throw new Error('API key must not be empty');
  }
  storage.setItem(API_KEY_STORAGE_KEY, trimmed);
}

/** Remove the API key from localStorage. */
export function removeApiKey(storage: Storage): void {
  storage.removeItem(API_KEY_STORAGE_KEY);
}

/** Get the raw API key, or null if none is stored. */
export function getApiKey(storage: Storage): string | null {
  return storage.getItem(API_KEY_STORAGE_KEY);
}

/** Check whether an API key is stored. */
export function hasApiKey(storage: Storage): boolean {
  return storage.getItem(API_KEY_STORAGE_KEY) !== null;
}

/**
 * Get a masked version of the stored key for display.
 * Shows the "sk-ant-" prefix and last 4 characters; masks the rest.
 * Returns null if no key is stored.
 */
export function getMaskedApiKey(storage: Storage): string | null {
  const key = storage.getItem(API_KEY_STORAGE_KEY);
  if (key === null) return null;

  // Short keys: mask entirely or show minimal context
  if (key.length <= FULLY_MASKED_THRESHOLD) {
    return MASK_CHAR.repeat(key.length);
  }

  // Medium keys: show first 2 + mask + last 2
  if (key.length < SHORT_KEY_THRESHOLD) {
    const prefix = key.slice(0, SHORT_PREFIX_LENGTH);
    const suffix = key.slice(-SHORT_SUFFIX_LENGTH);
    const maskedLength = key.length - SHORT_PREFIX_LENGTH - SHORT_SUFFIX_LENGTH;
    return prefix + MASK_CHAR.repeat(maskedLength) + suffix;
  }

  // Standard Anthropic-style keys: show "sk-ant-" prefix + last 4
  const prefix = key.slice(0, LONG_PREFIX_LENGTH);
  const suffix = key.slice(-LONG_SUFFIX_LENGTH);
  const maskedLength = key.length - LONG_PREFIX_LENGTH - LONG_SUFFIX_LENGTH;
  return prefix + MASK_CHAR.repeat(maskedLength) + suffix;
}
