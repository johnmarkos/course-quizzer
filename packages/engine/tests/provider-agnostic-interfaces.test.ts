import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ContentGenerator,
  CourseEngine,
  SyllabusParser,
  type CourseEngineConfig,
  type ProviderClient,
  type ProviderResponse,
} from '../src/index.js';

function mockResponse(): ProviderResponse {
  return {
    id: 'msg-1',
    content: [],
    model: 'test-model',
    stopReason: 'end_turn',
    usage: {
      inputTokens: 1,
      outputTokens: 1,
    },
  };
}

function mockProvider(): ProviderClient {
  return {
    sendMessage: vi.fn().mockResolvedValue(mockResponse()),
  };
}

function readSource(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
}

describe('provider-agnostic interfaces', () => {
  it('accepts structural provider clients outside the provider layer', () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);
    const parser = new SyllabusParser(provider);
    const config: CourseEngineConfig = { provider, generator };

    const engine = new CourseEngine(config);

    expect(engine.state).toBe('idle');
    expect(parser).toBeInstanceOf(SyllabusParser);
  });

  it('keeps Claude-specific types inside the provider layer', () => {
    const nonProviderSources = [
      'content/ContentGenerator.ts',
      'curriculum/SyllabusParser.ts',
      'engine/CourseEngine.ts',
      'engine/types.ts',
    ];

    for (const path of nonProviderSources) {
      expect(readSource(path), path).not.toContain('ClaudeProvider');
    }
  });
});
