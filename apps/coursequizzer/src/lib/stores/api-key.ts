// --- API Key Store ---
// Manages the user's Anthropic API key in localStorage.
// The key is stored as-is — no encryption (localStorage is same-origin).
// This module has no browser dependency at import time; localStorage
// is injected so it's testable without jsdom.

export const API_KEY_STORAGE_KEY = 'coursequizzer:api-key';

const MASK_CHAR = '•';
const VISIBLE_PREFIX_LENGTH = 7; // "sk-ant-" prefix
const VISIBLE_SUFFIX_LENGTH = 4;

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

  const minMaskableLength = VISIBLE_PREFIX_LENGTH + VISIBLE_SUFFIX_LENGTH + 1;
  if (key.length <= minMaskableLength) return key;

  const prefix = key.slice(0, VISIBLE_PREFIX_LENGTH);
  const suffix = key.slice(-VISIBLE_SUFFIX_LENGTH);
  const maskedLength = key.length - VISIBLE_PREFIX_LENGTH - VISIBLE_SUFFIX_LENGTH;
  return prefix + MASK_CHAR.repeat(maskedLength) + suffix;
}
