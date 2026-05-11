import { ClaudeProvider } from './ClaudeProvider.js';
import type { ClaudeProviderConfig } from './ClaudeProvider.js';
import type { ProviderClient } from './types.js';

export function createDefaultProvider(config: ClaudeProviderConfig): ProviderClient {
  return new ClaudeProvider(config);
}
