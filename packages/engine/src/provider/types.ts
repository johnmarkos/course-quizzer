// --- Provider Types ---
// Defines the interface for LLM API communication.
// All provider-specific code lives in this directory.
// The rest of the engine depends only on these types.

// --- Configuration ---

export type ProviderConfig = {
  apiKey: string;
  model?: string;
};

// --- Request/Response ---
// These types model the Anthropic Messages API shape,
// but are defined here so the rest of the engine never
// imports provider-specific structures.

export type MessageRole = 'user' | 'assistant';

export type TextContent = {
  type: 'text';
  text: string;
};

export type MessageContent = string | TextContent[];

export type Message = {
  role: MessageRole;
  content: MessageContent;
};

export type ProviderRequest = {
  system?: string;
  messages: Message[];
  maxTokens: number;
  /** Optional JSON schema to request structured output via tool_use. */
  tools?: ToolDefinition[];
  toolChoice?: ToolChoice;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string };

// --- Response ---

export type TextBlock = {
  type: 'text';
  text: string;
};

export type ToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ContentBlock = TextBlock | ToolUseBlock;

export type ProviderResponse = {
  id: string;
  content: ContentBlock[];
  model: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

// --- Errors ---

export type ProviderErrorType =
  | 'authentication' // 401 — bad API key
  | 'rate_limit' // 429 — too many requests
  | 'overloaded' // 529 — API overloaded
  | 'invalid_request' // 400 — bad request shape
  | 'server_error' // 5xx — server-side failure
  | 'network' // fetch failed entirely
  | 'malformed_response'; // response didn't parse

export class ProviderError extends Error {
  readonly type: ProviderErrorType;
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(type: ProviderErrorType, message: string, statusCode?: number) {
    super(message);
    this.name = 'ProviderError';
    this.type = type;
    this.statusCode = statusCode;
    this.retryable =
      type === 'rate_limit' || type === 'overloaded' || type === 'server_error';
  }
}
