import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeSyllabus,
  saveCourseFromPlan,
  type AnalysisResult,
  MIN_SYLLABUS_LENGTH,
  validateSyllabusInput,
} from '../../src/lib/stores/new-course.js';
import type { CurriculumPlan, ProviderResponse } from 'quizzer-engine';
import {
  getCourse,
  listCourses,
  COURSES_STORAGE_KEY,
} from '../../src/lib/storage/course-storage.js';

// --- localStorage mock ---

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// --- Test fixtures ---

function mockCurriculumPlan(): CurriculumPlan {
  return {
    title: 'Intro to Testing',
    description: 'A short course on software testing fundamentals.',
    sections: [
      {
        id: 'unit-testing',
        title: 'Unit Testing',
        order: 0,
        topics: [
          {
            id: 'test-basics',
            title: 'Test Basics',
            description: 'Writing your first unit test.',
          },
        ],
      },
      {
        id: 'integration-testing',
        title: 'Integration Testing',
        order: 1,
        topics: [
          {
            id: 'api-testing',
            title: 'API Testing',
            description: 'Testing HTTP endpoints end-to-end.',
          },
        ],
      },
    ],
  };
}

function mockProviderResponse(plan: CurriculumPlan): ProviderResponse {
  return {
    id: 'msg_test_01',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_test_01',
        name: 'create_curriculum_plan',
        input: plan as unknown as Record<string, unknown>,
      },
    ],
    model: 'claude-sonnet-4-20250514',
    stopReason: 'tool_use',
    usage: { inputTokens: 100, outputTokens: 200 },
  };
}

// --- Syllabus input validation ---

describe('validateSyllabusInput', () => {
  it('returns null for valid syllabus text', () => {
    const text = 'A'.repeat(MIN_SYLLABUS_LENGTH);
    expect(validateSyllabusInput(text)).toBeNull();
  });

  it('returns error for empty input', () => {
    expect(validateSyllabusInput('')).toBe('Please enter your syllabus text.');
  });

  it('returns error for whitespace-only input', () => {
    expect(validateSyllabusInput('   \n\t  ')).toBe('Please enter your syllabus text.');
  });

  it('returns error for too-short input', () => {
    expect(validateSyllabusInput('Short')).toBe(
      `Syllabus text is too short (minimum ${MIN_SYLLABUS_LENGTH} characters).`
    );
  });
});

// --- analyzeSyllabus ---

describe('analyzeSyllabus', () => {
  it('returns a curriculum plan on success', async () => {
    const plan = mockCurriculumPlan();
    const mockSendMessage = vi.fn().mockResolvedValue(mockProviderResponse(plan));

    const result = await analyzeSyllabus({
      syllabusText: 'A'.repeat(MIN_SYLLABUS_LENGTH + 10),
      sendMessage: mockSendMessage,
    });

    expect(result.ok).toBe(true);
    const success = result as Extract<AnalysisResult, { ok: true }>;
    expect(success.plan.title).toBe('Intro to Testing');
    expect(success.plan.sections).toHaveLength(2);
    expect(mockSendMessage).toHaveBeenCalledOnce();
  });

  it('retries once on malformed response then succeeds', async () => {
    const plan = mockCurriculumPlan();
    const badResponse: ProviderResponse = {
      id: 'msg_bad',
      content: [{ type: 'text', text: 'no tool use here' }],
      model: 'claude-sonnet-4-20250514',
      stopReason: 'end_turn',
      usage: { inputTokens: 50, outputTokens: 50 },
    };

    const mockSendMessage = vi
      .fn()
      .mockResolvedValueOnce(badResponse)
      .mockResolvedValueOnce(mockProviderResponse(plan));

    const result = await analyzeSyllabus({
      syllabusText: 'A'.repeat(MIN_SYLLABUS_LENGTH + 10),
      sendMessage: mockSendMessage,
    });

    expect(result.ok).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('returns error after two malformed responses', async () => {
    const badResponse: ProviderResponse = {
      id: 'msg_bad',
      content: [{ type: 'text', text: 'no tool use here' }],
      model: 'claude-sonnet-4-20250514',
      stopReason: 'end_turn',
      usage: { inputTokens: 50, outputTokens: 50 },
    };

    const mockSendMessage = vi
      .fn()
      .mockResolvedValueOnce(badResponse)
      .mockResolvedValueOnce(badResponse);

    const result = await analyzeSyllabus({
      syllabusText: 'A'.repeat(MIN_SYLLABUS_LENGTH + 10),
      sendMessage: mockSendMessage,
    });

    expect(result.ok).toBe(false);
    const failure = result as Extract<AnalysisResult, { ok: false }>;
    expect(failure.error).toBe(
      'The API returned an unexpected response. Please try again.'
    );
    expect(failure.errorType).toBe('malformed_response');
  });

  it('returns user-readable error for authentication failure', async () => {
    const { ProviderError } = await import('quizzer-engine');
    const mockSendMessage = vi
      .fn()
      .mockRejectedValue(new ProviderError('authentication', 'Invalid API key', 401));

    const result = await analyzeSyllabus({
      syllabusText: 'A'.repeat(MIN_SYLLABUS_LENGTH + 10),
      sendMessage: mockSendMessage,
    });

    expect(result.ok).toBe(false);
    const failure = result as Extract<AnalysisResult, { ok: false }>;
    expect(failure.error).toContain('API key');
    expect(failure.errorType).toBe('authentication');
  });

  it('returns user-readable error for rate limit', async () => {
    const { ProviderError } = await import('quizzer-engine');
    const mockSendMessage = vi
      .fn()
      .mockRejectedValue(new ProviderError('rate_limit', 'Rate limited', 429));

    const result = await analyzeSyllabus({
      syllabusText: 'A'.repeat(MIN_SYLLABUS_LENGTH + 10),
      sendMessage: mockSendMessage,
    });

    expect(result.ok).toBe(false);
    const failure = result as Extract<AnalysisResult, { ok: false }>;
    expect(failure.errorType).toBe('rate_limit');
  });

  it('returns user-readable error for network failure', async () => {
    const { ProviderError } = await import('quizzer-engine');
    const mockSendMessage = vi
      .fn()
      .mockRejectedValue(new ProviderError('network', 'Failed to fetch'));

    const result = await analyzeSyllabus({
      syllabusText: 'A'.repeat(MIN_SYLLABUS_LENGTH + 10),
      sendMessage: mockSendMessage,
    });

    expect(result.ok).toBe(false);
    const failure = result as Extract<AnalysisResult, { ok: false }>;
    expect(failure.errorType).toBe('network');
  });

  it('does not leak API key or raw headers in error messages', async () => {
    const { ProviderError } = await import('quizzer-engine');
    const sensitiveMessage =
      'Invalid key sk-ant-api03-secret x-api-key: sk-ant-api03-secret';
    const mockSendMessage = vi
      .fn()
      .mockRejectedValue(new ProviderError('authentication', sensitiveMessage, 401));

    const result = await analyzeSyllabus({
      syllabusText: 'A'.repeat(MIN_SYLLABUS_LENGTH + 10),
      sendMessage: mockSendMessage,
    });

    expect(result.ok).toBe(false);
    const failure = result as Extract<AnalysisResult, { ok: false }>;
    expect(failure.error).not.toContain('sk-ant-api03');
    expect(failure.error).not.toContain('x-api-key');
  });
});

// --- saveCourseFromPlan ---

describe('saveCourseFromPlan', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createLocalStorageMock();
  });

  it('saves a course and returns the record', () => {
    const plan = mockCurriculumPlan();
    const record = saveCourseFromPlan(plan, storage);

    expect(record.id).toBeTruthy();
    expect(record.title).toBe('Intro to Testing');
    expect(record.curriculum).toEqual(plan);
  });

  it('saved course can be loaded by id', () => {
    const plan = mockCurriculumPlan();
    const record = saveCourseFromPlan(plan, storage);

    const loaded = getCourse(record.id, storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe('Intro to Testing');
    expect(loaded!.curriculum.sections).toHaveLength(2);
  });

  it('creates a record that appears in listCourses', () => {
    const plan = mockCurriculumPlan();
    saveCourseFromPlan(plan, storage);

    const courses = listCourses(storage);
    expect(courses).toHaveLength(1);
    expect(courses[0].title).toBe('Intro to Testing');
  });
});
