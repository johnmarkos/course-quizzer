import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveApiKey,
  removeApiKey,
  getApiKey,
  hasApiKey,
  getMaskedApiKey,
  API_KEY_STORAGE_KEY,
} from '../../src/lib/stores/api-key.js';

// --- localStorage mock ---

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

describe('api-key store', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createLocalStorageMock();
  });

  // --- saveApiKey ---

  it('saves a key to localStorage', () => {
    saveApiKey('sk-ant-api03-test-key-1234', storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      API_KEY_STORAGE_KEY,
      'sk-ant-api03-test-key-1234'
    );
  });

  it('rejects an empty key', () => {
    expect(() => saveApiKey('', storage)).toThrow();
  });

  it('rejects a whitespace-only key', () => {
    expect(() => saveApiKey('   ', storage)).toThrow();
  });

  it('trims whitespace from the key before saving', () => {
    saveApiKey('  sk-ant-api03-test  ', storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      API_KEY_STORAGE_KEY,
      'sk-ant-api03-test'
    );
  });

  // --- removeApiKey ---

  it('removes the key from localStorage', () => {
    saveApiKey('sk-ant-api03-test-key', storage);
    removeApiKey(storage);
    expect(storage.removeItem).toHaveBeenCalledWith(API_KEY_STORAGE_KEY);
  });

  // --- getApiKey ---

  it('returns the stored key', () => {
    saveApiKey('sk-ant-api03-test-key', storage);
    expect(getApiKey(storage)).toBe('sk-ant-api03-test-key');
  });

  it('returns null when no key is stored', () => {
    expect(getApiKey(storage)).toBeNull();
  });

  // --- hasApiKey ---

  it('returns true when a key is stored', () => {
    saveApiKey('sk-ant-api03-test-key', storage);
    expect(hasApiKey(storage)).toBe(true);
  });

  it('returns false when no key is stored', () => {
    expect(hasApiKey(storage)).toBe(false);
  });

  // --- getMaskedApiKey ---

  it('masks a stored key showing only the last 4 characters', () => {
    saveApiKey('sk-ant-api03-abcdefghijklmnop', storage);
    const masked = getMaskedApiKey(storage);
    expect(masked).toBe('sk-ant-••••••••••••••••••mnop');
  });

  it('returns null when no key is stored', () => {
    expect(getMaskedApiKey(storage)).toBeNull();
  });

  it('masks a short key instead of returning it verbatim', () => {
    saveApiKey('abcd', storage);
    const masked = getMaskedApiKey(storage);
    // Short keys are fully masked — never shown verbatim
    expect(masked).toBe('••••');
    expect(masked).not.toBe('abcd');
  });

  it('masks a very short key (1 char)', () => {
    saveApiKey('x', storage);
    const masked = getMaskedApiKey(storage);
    expect(masked).toBe('•');
  });

  it('masks a medium-short key showing partial prefix and suffix', () => {
    saveApiKey('secret99', storage);
    const masked = getMaskedApiKey(storage);
    // 8 chars: show first 2, mask middle, show last 2
    expect(masked).toBe('se••••99');
  });

  it('masks a key with exactly the prefix plus a few chars', () => {
    saveApiKey('sk-ant-api03-xy', storage);
    const masked = getMaskedApiKey(storage);
    // 15 chars: prefix "sk-ant-" (7) + 4 masked + suffix "3-xy" (4)
    expect(masked).toBe('sk-ant-••••3-xy');
  });

  it('never returns a stored key verbatim regardless of length', () => {
    // Verify the core invariant across various lengths
    for (const key of ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef', 'abcdefgh']) {
      saveApiKey(key, storage);
      const masked = getMaskedApiKey(storage);
      expect(masked, `key "${key}" was returned verbatim`).not.toBe(key);
    }
  });
});
