import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeProvider, ProviderError, RateLimiter } from '../src/index.js';
import type { ProviderRequest } from '../src/index.js';

// --- Mock Fetch ---

function mockFetchResponse(body: unknown, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    })
  );
}

function mockFetchNetworkError(message: string): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)));
}

function mockAnthropicResponse(text = 'Hello!') {
  return {
    id: 'msg_test123',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

function mockToolUseResponse(name: string, input: Record<string, unknown>) {
  return {
    id: 'msg_test456',
    content: [{ type: 'tool_use', id: 'toolu_test', name, input }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'tool_use',
    usage: { input_tokens: 15, output_tokens: 20 },
  };
}

const TEST_CONFIG = { apiKey: 'sk-ant-test-key', rateLimiter: { maxTokens: 100 } };

function simpleRequest(): ProviderRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    maxTokens: 100,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// --- Request Formatting ---

describe('ClaudeProvider request formatting', () => {
  it('sends correctly formatted Messages API requests', async () => {
    mockFetchResponse(mockAnthropicResponse());
    const provider = new ClaudeProvider(TEST_CONFIG);

    await provider.sendMessage({
      system: 'You are a helpful tutor.',
      messages: [{ role: 'user', content: 'Explain atoms.' }],
      maxTokens: 500,
    });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.anthropic.com/v1/messages');

    const body = JSON.parse(fetchCall[1]!.body as string);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.max_tokens).toBe(500);
    expect(body.system).toBe('You are a helpful tutor.');
    expect(body.messages).toEqual([{ role: 'user', content: 'Explain atoms.' }]);
  });

  it('includes required headers including browser-access', async () => {
    mockFetchResponse(mockAnthropicResponse());
    const provider = new ClaudeProvider(TEST_CONFIG);

    await provider.sendMessage(simpleRequest());

    const headers = vi.mocked(fetch).mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends tools and tool_choice when provided', async () => {
    mockFetchResponse(mockToolUseResponse('generate_quiz', { questions: [] }));
    const provider = new ClaudeProvider(TEST_CONFIG);

    await provider.sendMessage({
      messages: [{ role: 'user', content: 'Generate a quiz.' }],
      maxTokens: 1000,
      tools: [
        {
          name: 'generate_quiz',
          description: 'Generate quiz questions',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      toolChoice: { type: 'tool', name: 'generate_quiz' },
    });

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].name).toBe('generate_quiz');
    // Verify camelCase inputSchema is converted to Anthropic's snake_case
    expect(body.tools[0].input_schema).toEqual({ type: 'object', properties: {} });
    expect(body.tools[0].inputSchema).toBeUndefined();
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'generate_quiz' });
  });

  it('omits system, tools, tool_choice when not provided', async () => {
    mockFetchResponse(mockAnthropicResponse());
    const provider = new ClaudeProvider(TEST_CONFIG);

    await provider.sendMessage(simpleRequest());

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.system).toBeUndefined();
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it('uses custom model when configured', async () => {
    mockFetchResponse(mockAnthropicResponse());
    const provider = new ClaudeProvider({
      ...TEST_CONFIG,
      model: 'claude-haiku-4-5-20251001',
    });

    expect(provider.model).toBe('claude-haiku-4-5-20251001');

    await provider.sendMessage(simpleRequest());

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
  });
});

// --- Response Parsing ---

describe('ClaudeProvider response parsing', () => {
  it('parses text response correctly', async () => {
    mockFetchResponse(mockAnthropicResponse('The answer is 42.'));
    const provider = new ClaudeProvider(TEST_CONFIG);

    const result = await provider.sendMessage(simpleRequest());

    expect(result.id).toBe('msg_test123');
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.stopReason).toBe('end_turn');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as { type: 'text'; text: string }).text).toBe(
      'The answer is 42.'
    );
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
  });

  it('parses tool_use response correctly', async () => {
    const quizData = { questions: [{ q: 'What is 2+2?', a: '4' }] };
    mockFetchResponse(mockToolUseResponse('generate_quiz', quizData));
    const provider = new ClaudeProvider(TEST_CONFIG);

    const result = await provider.sendMessage(simpleRequest());

    expect(result.content).toHaveLength(1);
    const block = result.content[0];
    expect(block.type).toBe('tool_use');
    if (block.type === 'tool_use') {
      expect(block.name).toBe('generate_quiz');
      expect(block.input).toEqual(quizData);
      expect(block.id).toBe('toolu_test');
    }
  });
});

// --- API Key Security ---

describe('API key handling', () => {
  it('only sends API key in x-api-key header', async () => {
    mockFetchResponse(mockAnthropicResponse());
    const provider = new ClaudeProvider(TEST_CONFIG);

    await provider.sendMessage(simpleRequest());

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]!.headers as Record<string, string>;
    const body = call[1]!.body as string;
    const url = call[0] as string;

    // Key is in the header
    expect(headers['x-api-key']).toBe('sk-ant-test-key');
    // Key is NOT in the body or URL
    expect(body).not.toContain('sk-ant-test-key');
    expect(url).not.toContain('sk-ant-test-key');
  });
});

// --- testConnection ---

describe('testConnection', () => {
  it('returns true for a valid key', async () => {
    mockFetchResponse(mockAnthropicResponse());
    const provider = new ClaudeProvider(TEST_CONFIG);

    const result = await provider.testConnection();
    expect(result).toBe(true);

    // Should use minimal tokens
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.max_tokens).toBe(1);
  });

  it('throws ProviderError for invalid key', async () => {
    mockFetchResponse(
      { error: { type: 'authentication_error', message: 'Invalid API key' } },
      401
    );
    const provider = new ClaudeProvider(TEST_CONFIG);

    await expect(provider.testConnection()).rejects.toThrow(ProviderError);
    await expect(provider.testConnection()).rejects.toMatchObject({
      type: 'authentication',
      statusCode: 401,
    });
  });
});

// --- Error Handling ---

describe('error handling', () => {
  it('throws authentication error on 401', async () => {
    mockFetchResponse(
      { error: { type: 'authentication_error', message: 'Invalid API key' } },
      401
    );
    const provider = new ClaudeProvider(TEST_CONFIG);

    try {
      await provider.sendMessage(simpleRequest());
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      const pe = error as ProviderError;
      expect(pe.type).toBe('authentication');
      expect(pe.statusCode).toBe(401);
      expect(pe.retryable).toBe(false);
    }
  });

  it('throws rate_limit error on 429', async () => {
    mockFetchResponse(
      { error: { type: 'rate_limit_error', message: 'Rate limited' } },
      429
    );
    const provider = new ClaudeProvider(TEST_CONFIG);

    try {
      await provider.sendMessage(simpleRequest());
      expect.fail('Should have thrown');
    } catch (error) {
      const pe = error as ProviderError;
      expect(pe.type).toBe('rate_limit');
      expect(pe.retryable).toBe(true);
    }
  });

  it('throws overloaded error on 529', async () => {
    mockFetchResponse(
      { error: { type: 'overloaded_error', message: 'Overloaded' } },
      529
    );
    const provider = new ClaudeProvider(TEST_CONFIG);

    try {
      await provider.sendMessage(simpleRequest());
      expect.fail('Should have thrown');
    } catch (error) {
      const pe = error as ProviderError;
      expect(pe.type).toBe('overloaded');
      expect(pe.retryable).toBe(true);
    }
  });

  it('throws invalid_request error on 400', async () => {
    mockFetchResponse(
      { error: { type: 'invalid_request_error', message: 'Bad request' } },
      400
    );
    const provider = new ClaudeProvider(TEST_CONFIG);

    try {
      await provider.sendMessage(simpleRequest());
      expect.fail('Should have thrown');
    } catch (error) {
      const pe = error as ProviderError;
      expect(pe.type).toBe('invalid_request');
      expect(pe.retryable).toBe(false);
    }
  });

  it('throws server_error on 500', async () => {
    mockFetchResponse({ error: { type: 'api_error', message: 'Internal error' } }, 500);
    const provider = new ClaudeProvider(TEST_CONFIG);

    try {
      await provider.sendMessage(simpleRequest());
      expect.fail('Should have thrown');
    } catch (error) {
      const pe = error as ProviderError;
      expect(pe.type).toBe('server_error');
      expect(pe.retryable).toBe(true);
    }
  });

  it('throws network error when fetch fails', async () => {
    mockFetchNetworkError('Failed to fetch');
    const provider = new ClaudeProvider(TEST_CONFIG);

    try {
      await provider.sendMessage(simpleRequest());
      expect.fail('Should have thrown');
    } catch (error) {
      const pe = error as ProviderError;
      expect(pe.type).toBe('network');
      expect(pe.message).toContain('Failed to fetch');
      expect(pe.retryable).toBe(false);
    }
  });

  it('throws malformed_response when JSON parsing fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('invalid json')),
      })
    );
    const provider = new ClaudeProvider(TEST_CONFIG);

    try {
      await provider.sendMessage(simpleRequest());
      expect.fail('Should have thrown');
    } catch (error) {
      const pe = error as ProviderError;
      expect(pe.type).toBe('malformed_response');
    }
  });

  it('throws malformed_response when response lacks required fields', async () => {
    mockFetchResponse({ unexpected: 'shape' });
    const provider = new ClaudeProvider(TEST_CONFIG);

    try {
      await provider.sendMessage(simpleRequest());
      expect.fail('Should have thrown');
    } catch (error) {
      const pe = error as ProviderError;
      expect(pe.type).toBe('malformed_response');
    }
  });
});

// --- Rate Limiter ---

describe('RateLimiter', () => {
  it('allows immediate requests when tokens are available', async () => {
    const limiter = new RateLimiter({ maxTokens: 3, refillIntervalMs: 1000 });

    const waited = await limiter.acquire();
    expect(waited).toBe(0);
    expect(limiter.availableTokens).toBe(2);
  });

  it('blocks when no tokens are available', async () => {
    const limiter = new RateLimiter({ maxTokens: 1, refillIntervalMs: 500 });

    // Consume the only token
    await limiter.acquire();
    expect(limiter.availableTokens).toBe(0);

    // Next acquire should wait
    const acquirePromise = limiter.acquire();
    vi.advanceTimersByTime(500);
    const waited = await acquirePromise;

    expect(waited).toBeGreaterThanOrEqual(0);
  });

  it('refills tokens over time', async () => {
    const limiter = new RateLimiter({ maxTokens: 3, refillIntervalMs: 100 });

    // Consume all tokens
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.availableTokens).toBe(0);

    // Advance time to refill 2 tokens
    vi.advanceTimersByTime(200);
    expect(limiter.availableTokens).toBe(2);
  });

  it('does not exceed maxTokens', async () => {
    const limiter = new RateLimiter({ maxTokens: 3, refillIntervalMs: 100 });

    // Advance far past full refill
    vi.advanceTimersByTime(10000);
    expect(limiter.availableTokens).toBe(3);
  });
});

// --- Integration: Rate Limiter + Provider ---

describe('ClaudeProvider with rate limiting', () => {
  it('sends requests through the rate limiter', async () => {
    mockFetchResponse(mockAnthropicResponse());
    const provider = new ClaudeProvider({
      apiKey: 'sk-ant-test-key',
      rateLimiter: { maxTokens: 2, refillIntervalMs: 1000 },
    });

    // Two immediate requests should work
    await provider.sendMessage(simpleRequest());
    await provider.sendMessage(simpleRequest());

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
