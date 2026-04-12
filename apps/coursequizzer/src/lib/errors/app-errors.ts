// --- App Error Normalization ---
// Maps engine, provider, storage, and unknown errors to user-safe messages.
// Ensures no API keys, raw headers, or localStorage dumps leak into the UI.
// This module is pure logic — no Svelte, no browser APIs at import time.

import { ProviderError, InvalidTransitionError, EngineError } from 'quizzer-engine';

// --- Types ---

export type AppErrorCategory =
  | 'authentication'
  | 'rate_limit'
  | 'overloaded'
  | 'invalid_request'
  | 'server_error'
  | 'network'
  | 'malformed_response'
  | 'invalid_state'
  | 'engine'
  | 'storage_quota'
  | 'storage_access'
  | 'unknown';

export type AppError = {
  message: string;
  category: AppErrorCategory;
  recoverable: boolean;
};

// --- User-readable messages ---

const PROVIDER_MESSAGES: Record<string, string> = {
  authentication:
    'Your API key was not accepted. Please check that it is correct in Settings.',
  rate_limit:
    'Too many requests — the Anthropic API rate limit was reached. Please wait a moment and try again.',
  overloaded:
    'The Anthropic API is currently overloaded. Please try again in a few minutes.',
  invalid_request:
    'The request to the API was invalid. This may be a bug — please report it.',
  server_error:
    'The Anthropic API returned a server error. Please try again in a few minutes.',
  network:
    'Could not reach the Anthropic API. Please check your internet connection and try again.',
  malformed_response: 'The API returned an unexpected response. Please try again.',
};

// --- Sensitive data scrubbing ---

const SENSITIVE_PATTERNS = [
  /sk-ant-api\S*/gi,
  /x-api-key[:\s]+\S*/gi,
  /coursequizzer:api-key/gi,
];

export function scrubSensitiveData(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[redacted]');
  }
  return result;
}

// --- Public API ---

/**
 * Normalize any error into a user-safe AppError.
 * Provider errors get mapped to known messages.
 * Storage errors are detected by DOMException name.
 * All other errors get a generic message with sensitive data scrubbed.
 */
export function normalizeError(err: unknown): AppError {
  // Provider errors — known types with safe messages
  if (err instanceof ProviderError) {
    const message =
      PROVIDER_MESSAGES[err.type] ?? 'An unexpected error occurred. Please try again.';
    return {
      message,
      category: err.type as AppErrorCategory,
      recoverable: err.retryable,
    };
  }

  // Engine state machine errors
  if (err instanceof InvalidTransitionError) {
    return {
      message: 'This action is not available right now. Please try a different action.',
      category: 'invalid_state',
      recoverable: false,
    };
  }

  // General engine errors
  if (err instanceof EngineError) {
    return {
      message: 'The learning engine encountered an error. Please try again.',
      category: 'engine',
      recoverable: false,
    };
  }

  // Storage errors (DOMException from localStorage)
  if (err instanceof DOMException) {
    if (err.name === 'QuotaExceededError') {
      return {
        message: 'Browser storage is full. Please delete some courses to free space.',
        category: 'storage_quota',
        recoverable: false,
      };
    }
    if (err.name === 'SecurityError') {
      return {
        message:
          'Browser storage access is blocked. Please check your browser privacy settings.',
        category: 'storage_access',
        recoverable: false,
      };
    }
  }

  // Unknown errors — scrub sensitive data from message
  if (err instanceof Error) {
    return {
      message: scrubSensitiveData(err.message),
      category: 'unknown',
      recoverable: false,
    };
  }

  return {
    message: 'An unexpected error occurred. Please try again.',
    category: 'unknown',
    recoverable: false,
  };
}

/** Check if an error is a localStorage-related DOMException. */
export function isStorageError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  return err.name === 'QuotaExceededError' || err.name === 'SecurityError';
}
