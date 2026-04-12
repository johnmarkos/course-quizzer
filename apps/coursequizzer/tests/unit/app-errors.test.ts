import { describe, it, expect } from 'vitest';
import {
  normalizeError,
  isStorageError,
  type AppError,
} from '../../src/lib/errors/app-errors.js';
import { ProviderError, InvalidTransitionError, EngineError } from 'quizzer-engine';

// --- normalizeError ---

describe('normalizeError', () => {
  // --- Provider errors ---

  it('maps authentication ProviderError to user-readable message', () => {
    const err = new ProviderError('authentication', 'Invalid API key', 401);
    const result = normalizeError(err);

    expect(result.message).toContain('API key');
    expect(result.category).toBe('authentication');
    expect(result.recoverable).toBe(false);
  });

  it('maps rate_limit ProviderError to user-readable message', () => {
    const err = new ProviderError('rate_limit', 'Rate limited', 429);
    const result = normalizeError(err);

    expect(result.message).toContain('rate limit');
    expect(result.category).toBe('rate_limit');
    expect(result.recoverable).toBe(true);
  });

  it('maps overloaded ProviderError to user-readable message', () => {
    const err = new ProviderError('overloaded', 'Overloaded', 529);
    const result = normalizeError(err);

    expect(result.category).toBe('overloaded');
    expect(result.recoverable).toBe(true);
  });

  it('maps network ProviderError to user-readable message', () => {
    const err = new ProviderError('network', 'Failed to fetch');
    const result = normalizeError(err);

    expect(result.message).toContain('internet connection');
    expect(result.category).toBe('network');
    expect(result.recoverable).toBe(true);
  });

  it('maps server_error ProviderError to user-readable message', () => {
    const err = new ProviderError('server_error', 'Internal error', 500);
    const result = normalizeError(err);

    expect(result.category).toBe('server_error');
    expect(result.recoverable).toBe(true);
  });

  it('maps invalid_request ProviderError to user-readable message', () => {
    const err = new ProviderError('invalid_request', 'Bad request', 400);
    const result = normalizeError(err);

    expect(result.category).toBe('invalid_request');
    expect(result.recoverable).toBe(false);
  });

  it('maps malformed_response ProviderError to user-readable message', () => {
    const err = new ProviderError('malformed_response', 'Bad JSON');
    const result = normalizeError(err);

    expect(result.category).toBe('malformed_response');
    // ProviderError marks malformed_response as non-retryable at the provider level,
    // but the app-level message still suggests trying again
    expect(result.recoverable).toBe(false);
  });

  // --- Engine errors ---

  it('maps InvalidTransitionError to user-readable message', () => {
    const err = new InvalidTransitionError('startSection', 'idle');
    const result = normalizeError(err);

    expect(result.category).toBe('invalid_state');
    expect(result.recoverable).toBe(false);
  });

  it('maps EngineError to user-readable message', () => {
    const err = new EngineError('Something went wrong');
    const result = normalizeError(err);

    expect(result.category).toBe('engine');
    expect(result.recoverable).toBe(false);
  });

  // --- Storage errors ---

  it('maps QuotaExceededError to user-readable message', () => {
    const err = new DOMException('Quota exceeded', 'QuotaExceededError');
    const result = normalizeError(err);

    expect(result.message).toContain('storage');
    expect(result.category).toBe('storage_quota');
    expect(result.recoverable).toBe(false);
  });

  it('maps SecurityError (storage access) to user-readable message', () => {
    const err = new DOMException('Storage access denied', 'SecurityError');
    const result = normalizeError(err);

    expect(result.message).toContain('storage');
    expect(result.category).toBe('storage_access');
    expect(result.recoverable).toBe(false);
  });

  // --- Unknown errors ---

  it('maps unknown Error to generic message', () => {
    const err = new Error('something weird');
    const result = normalizeError(err);

    expect(result.category).toBe('unknown');
    expect(result.recoverable).toBe(false);
  });

  it('maps non-Error value to generic message', () => {
    const result = normalizeError('a string error');

    expect(result.category).toBe('unknown');
    expect(result.recoverable).toBe(false);
    expect(result.message).toBeTruthy();
  });

  // --- Sensitive data scrubbing ---

  it('never includes API key patterns in normalized message', () => {
    const err = new Error(
      'Failed with key sk-ant-api03-secretdata x-api-key: sk-ant-api03-secretdata'
    );
    const result = normalizeError(err);

    expect(result.message).not.toContain('sk-ant-api03');
    expect(result.message).not.toContain('x-api-key');
  });

  it('never includes raw API key in ProviderError message', () => {
    const err = new ProviderError(
      'authentication',
      'Invalid key: sk-ant-api03-secret123',
      401
    );
    const result = normalizeError(err);

    expect(result.message).not.toContain('sk-ant-api03');
  });

  it('scrubs localStorage dump patterns from error messages', () => {
    const err = new Error(
      'Failed: {"coursequizzer:api-key":"sk-ant-api03-secret","coursequizzer:courses":"[...]"}'
    );
    const result = normalizeError(err);

    expect(result.message).not.toContain('sk-ant-api03');
    expect(result.message).not.toContain('coursequizzer:api-key');
  });
});

// --- isStorageError ---

describe('isStorageError', () => {
  it('returns true for QuotaExceededError', () => {
    const err = new DOMException('Quota exceeded', 'QuotaExceededError');
    expect(isStorageError(err)).toBe(true);
  });

  it('returns true for SecurityError', () => {
    const err = new DOMException('Access denied', 'SecurityError');
    expect(isStorageError(err)).toBe(true);
  });

  it('returns false for regular Error', () => {
    expect(isStorageError(new Error('nope'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isStorageError('string')).toBe(false);
    expect(isStorageError(null)).toBe(false);
  });
});
