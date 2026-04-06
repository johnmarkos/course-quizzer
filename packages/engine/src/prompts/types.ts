// --- Prompt Types ---
// Shared types for prompt builder functions.

import type { ProviderRequest } from '../provider/types.js';

/**
 * A prompt builder returns the ProviderRequest fields needed
 * for a specific feature. The caller (e.g., SyllabusParser)
 * adds maxTokens and sends it via ClaudeProvider.
 */
export type PromptMessages = Pick<
  ProviderRequest,
  'system' | 'messages' | 'tools' | 'toolChoice'
>;
