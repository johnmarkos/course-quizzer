import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ApiCallPayload = {
  id: string;
  purpose: string;
};

type EventListener = (payload: unknown) => void;

let listeners: Map<string, EventListener[]>;

class MockCourseEngine {
  state = 'idle';
  curriculum = null;

  constructor(_config: unknown) {}

  on(event: string, listener: EventListener): void {
    listeners.set(event, [...(listeners.get(event) ?? []), listener]);
  }

  off(event: string, listener: EventListener): void {
    listeners.set(
      event,
      (listeners.get(event) ?? []).filter(
        (currentListener) => currentListener !== listener
      )
    );
  }
}

function emitApiEvent(
  event: 'apiCallStart' | 'apiCallComplete',
  payload: ApiCallPayload
): void {
  for (const listener of listeners.get(event) ?? []) {
    listener(payload);
  }
}

describe('createEngineSession API loading state', () => {
  beforeEach(() => {
    listeners = new Map();
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('quizzer-engine');
  });

  it('stays loading until every active API call id completes', async () => {
    vi.doMock('quizzer-engine', () => ({
      CourseEngine: MockCourseEngine,
    }));

    const { createEngineSession } =
      await import('../../src/lib/stores/engine-session.svelte.js');

    const session = createEngineSession({ apiKey: 'test-key' });

    emitApiEvent('apiCallStart', { id: 'api-call-1', purpose: 'Explanation' });
    emitApiEvent('apiCallStart', { id: 'api-call-2', purpose: 'Quiz' });
    expect(session.apiLoading).toBe(true);

    emitApiEvent('apiCallComplete', { id: 'api-call-1', purpose: 'Explanation' });
    expect(session.apiLoading).toBe(true);

    emitApiEvent('apiCallComplete', { id: 'api-call-2', purpose: 'Quiz' });
    expect(session.apiLoading).toBe(false);
  });
});
