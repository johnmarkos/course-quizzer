// --- ClaudeProvider ---
// API client for direct browser-to-Claude communication.
// Uses the Anthropic Messages API with the `anthropic-dangerous-direct-browser-access`
// header, which allows browser fetch calls without a backend proxy.
//
// This is the only file in the engine that knows about the Anthropic API shape.
// The rest of the engine works through ProviderRequest/ProviderResponse types.
//
// Reference: PageQuizzer's AnthropicProvider for the browser-access pattern.

import { RateLimiter } from './rate-limiter.js';
import type { RateLimiterConfig } from './rate-limiter.js';
import {
  ProviderError,
  type ProviderConfig,
  type ProviderClient,
  type ProviderRequest,
  type ProviderResponse,
  type ContentBlock,
} from './types.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// --- Anthropic API Types ---
// Internal types that model the raw API request/response shapes.
// Not exported — the public interface uses ProviderRequest/ProviderResponse.

type AnthropicRequest = {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{ type: 'text'; text: string }>;
  }>;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
  tool_choice?: { type: string; name?: string };
};

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

type AnthropicResponse = {
  id: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

type AnthropicErrorResponse = {
  error?: {
    type: string;
    message: string;
  };
};

export type ClaudeProviderConfig = ProviderConfig & {
  rateLimiter?: Partial<RateLimiterConfig>;
};

export class ClaudeProvider implements ProviderClient {
  #apiKey: string;
  #model: string;
  #rateLimiter: RateLimiter;

  constructor(config: ClaudeProviderConfig) {
    this.#apiKey = config.apiKey;
    this.#model = config.model ?? DEFAULT_MODEL;
    this.#rateLimiter = new RateLimiter(config.rateLimiter);
  }

  // --- Public API ---

  get model(): string {
    return this.#model;
  }

  /**
   * Send a message to the Claude API and return the parsed response.
   * Respects rate limiting — may delay before sending.
   */
  async sendMessage(request: ProviderRequest): Promise<ProviderResponse> {
    await this.#rateLimiter.acquire();

    const body = this.#buildRequestBody(request);
    const raw = await this.#fetch(body);
    return this.#parseResponse(raw);
  }

  /**
   * Validate that the API key works with a minimal API call.
   * Returns true if the key is valid, throws ProviderError otherwise.
   */
  async testConnection(): Promise<boolean> {
    await this.#rateLimiter.acquire();

    const body: AnthropicRequest = {
      model: this.#model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await this.#fetch(body);
    return true;
  }

  // --- Request Building ---

  #buildRequestBody(request: ProviderRequest): AnthropicRequest {
    const body: AnthropicRequest = {
      model: this.#model,
      max_tokens: request.maxTokens,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (request.system) {
      body.system = request.system;
    }

    if (request.tools && request.tools.length > 0) {
      // Convert camelCase inputSchema to Anthropic's snake_case input_schema
      body.tools = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));
    }

    if (request.toolChoice) {
      body.tool_choice = request.toolChoice;
    }

    return body;
  }

  // --- HTTP ---

  async #fetch(body: AnthropicRequest): Promise<AnthropicResponse> {
    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.#apiKey,
          'anthropic-version': API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new ProviderError(
        'network',
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        { cause: error }
      );
    }

    if (!response.ok) {
      await this.#handleErrorResponse(response);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ProviderError(
        'malformed_response',
        'Failed to parse API response as JSON',
        response.status
      );
    }

    if (!this.#isAnthropicResponse(data)) {
      throw new ProviderError(
        'malformed_response',
        'API response missing required fields',
        response.status
      );
    }

    return data;
  }

  // --- Response Parsing ---

  #parseResponse(raw: AnthropicResponse): ProviderResponse {
    const content: ContentBlock[] = raw.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      }
      return {
        type: 'tool_use' as const,
        id: block.id,
        name: block.name,
        input: block.input,
      };
    });

    return {
      id: raw.id,
      content,
      model: raw.model,
      stopReason: raw.stop_reason,
      usage: {
        inputTokens: raw.usage.input_tokens,
        outputTokens: raw.usage.output_tokens,
      },
    };
  }

  // --- Error Handling ---

  async #handleErrorResponse(response: Response): Promise<never> {
    let errorMessage: string;
    try {
      const errorData: AnthropicErrorResponse = await response.json();
      errorMessage = errorData.error?.message ?? `HTTP ${response.status}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }

    const status = response.status;

    if (status === 401) {
      throw new ProviderError('authentication', errorMessage, status);
    }
    if (status === 429) {
      throw new ProviderError('rate_limit', errorMessage, status);
    }
    if (status === 400) {
      throw new ProviderError('invalid_request', errorMessage, status);
    }
    if (status === 529) {
      throw new ProviderError('overloaded', errorMessage, status);
    }
    if (status >= 500) {
      throw new ProviderError('server_error', errorMessage, status);
    }

    // Catch-all for unexpected status codes
    throw new ProviderError('server_error', errorMessage, status);
  }

  // --- Validation ---

  #isAnthropicResponse(data: unknown): data is AnthropicResponse {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      Array.isArray(obj.content) &&
      typeof obj.model === 'string' &&
      typeof obj.usage === 'object' &&
      obj.usage !== null
    );
  }
}
