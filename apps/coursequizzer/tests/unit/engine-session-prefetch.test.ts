import { beforeEach, describe, expect, it, vi } from 'vitest';

let capturedConfig: unknown;

class MockCourseEngine {
  state = 'idle';
  curriculum = null;

  constructor(config: unknown) {
    capturedConfig = config;
  }

  on(): void {}

  off(): void {}
}

describe('createEngineSession prefetch config', () => {
  beforeEach(() => {
    capturedConfig = null;
    vi.resetModules();
  });

  it('enables prefetch without creating a second generator config', async () => {
    vi.doMock('quizzer-engine', () => ({
      CourseEngine: MockCourseEngine,
    }));

    const { createEngineSession } =
      await import('../../src/lib/stores/engine-session.svelte.js');

    createEngineSession({ apiKey: 'test-key' });

    expect(capturedConfig).toEqual({
      apiKey: 'test-key',
      prefetch: {
        enabled: true,
      },
    });
  });
});
