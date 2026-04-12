import { describe, it, expect, vi } from 'vitest';
import {
  analyzeSyllabus,
  saveCourseFromPlan,
  MIN_SYLLABUS_LENGTH,
} from '../../src/lib/stores/new-course.js';
import {
  createEngineSession,
  type EngineSession,
} from '../../src/lib/stores/engine-session.svelte.js';
import { getCourse, listCourses } from '../../src/lib/storage/course-storage.js';
import type { CurriculumPlan, ProviderResponse, ContentItem } from 'quizzer-engine';

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

// --- Fixtures (mimic realistic Claude API response) ---

function mockCurriculumPlan(): CurriculumPlan {
  return {
    title: 'Data Structures',
    description: 'An introduction to fundamental data structures.',
    sections: [
      {
        id: 'arrays-and-lists',
        title: 'Arrays and Linked Lists',
        order: 0,
        topics: [
          {
            id: 'arrays',
            title: 'Arrays',
            description: 'Contiguous memory storage with O(1) access.',
          },
          {
            id: 'linked-lists',
            title: 'Linked Lists',
            description: 'Node-based storage with O(1) insertion.',
          },
        ],
      },
      {
        id: 'trees',
        title: 'Trees',
        order: 1,
        topics: [
          {
            id: 'binary-trees',
            title: 'Binary Trees',
            description: 'Hierarchical structures with two children per node.',
          },
        ],
      },
    ],
  };
}

function mockProviderResponse(plan: CurriculumPlan): ProviderResponse {
  return {
    id: 'msg_integration_01',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_integration_01',
        name: 'create_curriculum_plan',
        input: plan as unknown as Record<string, unknown>,
      },
    ],
    model: 'claude-sonnet-4-20250514',
    stopReason: 'tool_use',
    usage: { inputTokens: 150, outputTokens: 300 },
  };
}

function mockSectionContent(): ContentItem[] {
  return [
    {
      type: 'explanation',
      topicId: 'arrays',
      title: 'Understanding Arrays',
      content:
        'An array stores elements in contiguous memory locations, providing O(1) random access by index.',
    },
    {
      type: 'multiple-choice',
      id: 'q-arrays-1',
      topicId: 'arrays',
      question:
        'What is the time complexity of accessing an element by index in an array?',
      options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'],
      correctIndex: 0,
    },
    {
      type: 'numeric-input',
      id: 'q-arrays-2',
      topicId: 'arrays',
      question:
        'If an array has 8 elements, how many comparisons does binary search need in the worst case?',
      correctValue: 3,
      tolerance: 0,
    },
  ];
}

// --- Critical path: syllabus → analyze → save → session → answer ---

describe('critical path integration', () => {
  it('analyzes syllabus, saves course, creates session, and answers questions', async () => {
    const storage = createLocalStorageMock();
    const plan = mockCurriculumPlan();
    const syllabusText = 'A'.repeat(MIN_SYLLABUS_LENGTH + 100);

    // Step 1: Analyze syllabus with mocked provider
    const mockSendMessage = vi.fn().mockResolvedValue(mockProviderResponse(plan));
    const analysisResult = await analyzeSyllabus({
      syllabusText,
      sendMessage: mockSendMessage,
    });

    expect(analysisResult.ok).toBe(true);
    if (!analysisResult.ok) throw new Error('Analysis failed');
    expect(analysisResult.plan.title).toBe('Data Structures');
    expect(analysisResult.plan.sections).toHaveLength(2);

    // Step 2: Save course from the analyzed plan
    const courseRecord = saveCourseFromPlan(analysisResult.plan, storage);
    expect(courseRecord.id).toBeTruthy();
    expect(courseRecord.title).toBe('Data Structures');

    // Verify the course is in storage
    const courses = listCourses(storage);
    expect(courses).toHaveLength(1);
    expect(courses[0].id).toBe(courseRecord.id);

    // Step 3: Create an engine session with auto-save
    const session = createEngineSession({
      apiKey: 'sk-ant-test-key',
      courseId: courseRecord.id,
      storage,
    });

    session.loadCurriculum(analysisResult.plan);
    expect(session.engineState).toBe('ready');
    expect(session.curriculum).not.toBeNull();

    // Step 4: Start section and load content
    session.startSection('arrays-and-lists');
    expect(session.engineState).toBe('loading');
    expect(session.currentSection!.section.id).toBe('arrays-and-lists');

    session.setSectionContent(mockSectionContent());
    expect(session.engineState).toBe('practicing');

    // Step 5: Read explanation, then answer questions
    expect(session.currentItem!.item.type).toBe('explanation');
    session.nextItem();

    // Answer multiple-choice correctly
    expect(session.currentItem!.item.type).toBe('multiple-choice');
    const mcResult = session.submitAnswer({
      type: 'multiple-choice',
      selectedIndex: 0,
    });
    expect(mcResult.correct).toBe(true);
    expect(session.engineState).toBe('answered');
    session.nextItem();

    // Answer numeric-input correctly
    expect(session.currentItem!.item.type).toBe('numeric-input');
    const numResult = session.submitAnswer({
      type: 'numeric-input',
      value: 3,
    });
    expect(numResult.correct).toBe(true);
    session.nextItem();

    // Section complete
    expect(session.engineState).toBe('sectionComplete');

    // Step 6: Verify auto-save persisted progress
    const savedCourse = getCourse(courseRecord.id, storage);
    expect(savedCourse).not.toBeNull();
    expect(savedCourse!.snapshot).not.toBeNull();
    expect(savedCourse!.snapshot!.state).toBe('sectionComplete');

    // Step 7: Verify API key is NOT in persisted data
    const raw = JSON.stringify(savedCourse);
    expect(raw).not.toContain('sk-ant-test-key');

    // Clean up
    session.dispose();
  });

  it('restores a saved session and continues answering', async () => {
    const storage = createLocalStorageMock();
    const plan = mockCurriculumPlan();

    // Create and progress a session
    const courseRecord = saveCourseFromPlan(plan, storage);
    const session1 = createEngineSession({
      apiKey: 'sk-ant-key-1',
      courseId: courseRecord.id,
      storage,
    });

    session1.loadCurriculum(plan);
    session1.startSection('arrays-and-lists');
    session1.setSectionContent(mockSectionContent());
    session1.nextItem(); // past explanation
    session1.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });

    // Take snapshot and dispose
    const snapshot = session1.serialize()!;
    expect(snapshot).not.toBeNull();
    session1.dispose();

    // Restore into a new session (simulating page reload)
    const session2 = createEngineSession({
      apiKey: 'sk-ant-key-2',
      courseId: courseRecord.id,
      storage,
      snapshot,
    });

    // Session should be in the answered state
    expect(session2.engineState).toBe('answered');
    expect(session2.curriculum).not.toBeNull();
    expect(session2.curriculum!.title).toBe('Data Structures');

    // Continue to the next item
    session2.nextItem();
    expect(session2.currentItem!.item.type).toBe('numeric-input');

    // Answer and complete section
    session2.submitAnswer({ type: 'numeric-input', value: 3 });
    session2.nextItem();
    expect(session2.engineState).toBe('sectionComplete');

    // Verify the restored session's API key isn't leaked
    const snapshot2 = session2.serialize()!;
    const serialized = JSON.stringify(snapshot2);
    expect(serialized).not.toContain('sk-ant-key-1');
    expect(serialized).not.toContain('sk-ant-key-2');

    session2.dispose();
  });

  it('handles analysis failure and allows retry', async () => {
    const plan = mockCurriculumPlan();
    const syllabusText = 'A'.repeat(MIN_SYLLABUS_LENGTH + 10);

    // First attempt: both calls return malformed responses
    const badResponse: ProviderResponse = {
      id: 'msg_bad',
      content: [{ type: 'text', text: 'I cannot analyze this.' }],
      model: 'claude-sonnet-4-20250514',
      stopReason: 'end_turn',
      usage: { inputTokens: 50, outputTokens: 50 },
    };

    const failingSendMessage = vi.fn().mockResolvedValue(badResponse);
    const failResult = await analyzeSyllabus({
      syllabusText,
      sendMessage: failingSendMessage,
    });

    expect(failResult.ok).toBe(false);

    // Retry: succeeds on first call
    const succeedingSendMessage = vi.fn().mockResolvedValue(mockProviderResponse(plan));
    const retryResult = await analyzeSyllabus({
      syllabusText,
      sendMessage: succeedingSendMessage,
    });

    expect(retryResult.ok).toBe(true);
    if (retryResult.ok) {
      expect(retryResult.plan.title).toBe('Data Structures');
    }
  });
});
