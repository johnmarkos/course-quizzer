import { ClaudeProvider, type ClaudeProviderConfig } from './ClaudeProvider.js';
import type { ProviderClient } from './types.js';

export type DefaultProviderConfig = ClaudeProviderConfig;

export function createDefaultProvider(config: DefaultProviderConfig): ProviderClient {
  return new ClaudeProvider(config);
}
