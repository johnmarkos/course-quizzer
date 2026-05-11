import { describe, it, expect, vi } from 'vitest';
import {
  createEngineSession,
  type EngineSession,
} from '../../src/lib/stores/engine-session.svelte.js';
import { createCourse, getCourse } from '../../src/lib/storage/course-storage.js';
import type {
  CodeAnswerEvaluator,
  CurriculumPlan,
  ContentItem,
  StudentAnswer,
} from 'quizzer-engine';

// --- Test fixtures ---

function mockCurriculumPlan(): CurriculumPlan {
  return {
    title: 'Intro to Testing',
    description: 'A course about testing fundamentals.',
    sections: [
      {
        id: 's1',
        title: 'Unit Testing Basics',
        order: 0,
        topics: [
          {
            id: 't1',
            title: 'What is a Unit Test?',
            description: 'The fundamentals of unit testing.',
          },
        ],
      },
      {
        id: 's2',
        title: 'Integration Testing',
        order: 1,
        topics: [
          {
            id: 't2',
            title: 'Integration Strategies',
            description: 'Approaches to integration testing.',
          },
        ],
      },
    ],
  };
}

// Content items covering all 5 question types plus an explanation
function mockSectionContent(): ContentItem[] {
  return [
    {
      type: 'explanation',
      topicId: 't1',
      title: 'Understanding Unit Tests',
      content: 'A unit test verifies a single piece of functionality in isolation.',
    },
    {
      type: 'multiple-choice',
      id: 'q1',
      topicId: 't1',
      question: 'What does a unit test verify?',
      options: [
        'The entire application',
        'A single piece of functionality',
        'Network connectivity',
        'Database schemas',
      ],
      correctIndex: 1,
    },
    {
      type: 'numeric-input',
      id: 'q2',
      topicId: 't1',
      question: 'How many assertions should a focused unit test typically have?',
      correctValue: 1,
      tolerance: 1,
    },
    {
      type: 'ordering',
      id: 'q3',
      topicId: 't1',
      question: 'Put the TDD steps in order.',
      items: ['Red', 'Green', 'Refactor'],
      correctOrder: [0, 1, 2],
    },
    {
      type: 'multi-select',
      id: 'q4',
      topicId: 't1',
      question: 'Which are benefits of unit testing?',
      options: [
        'Fast feedback',
        'Slower builds',
        'Regression prevention',
        'Increased code size',
      ],
      correctIndices: [0, 2],
    },
    {
      type: 'two-stage',
      id: 'q5',
      topicId: 't1',
      question: 'Which testing level runs fastest?',
      options: ['Unit', 'Integration', 'E2E'],
      correctIndex: 0,
      followUp: 'Why does it run fastest?',
      followUpOptions: ['No external deps', 'More code coverage', 'Uses caching'],
      followUpCorrectIndex: 0,
    },
  ];
}

describe('learn page flow', () => {
  // --- Full answer flow with mocked generated content ---

  it('completes a full section: explanation → answer questions → section complete', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockSectionContent());

    // Item 0: explanation
    expect(session.engineState).toBe('practicing');
    expect(session.currentItem!.item.type).toBe('explanation');
    expect(session.currentItem!.itemIndex).toBe(0);
    expect(session.currentItem!.totalItems).toBe(6);

    // Advance past explanation
    session.nextItem();

    // Item 1: multiple-choice
    expect(session.currentItem!.item.type).toBe('multiple-choice');
    const mcResult = session.submitAnswer({
      type: 'multiple-choice',
      selectedIndex: 1,
    });
    expect(mcResult.correct).toBe(true);
    expect(session.engineState).toBe('answered');
    expect(session.lastResult!.result.correct).toBe(true);
    session.nextItem();

    // Item 2: numeric-input
    expect(session.currentItem!.item.type).toBe('numeric-input');
    const numResult = session.submitAnswer({
      type: 'numeric-input',
      value: 1,
    });
    expect(numResult.correct).toBe(true);
    session.nextItem();

    // Item 3: ordering
    expect(session.currentItem!.item.type).toBe('ordering');
    const orderResult = session.submitAnswer({
      type: 'ordering',
      order: [0, 1, 2],
    });
    expect(orderResult.correct).toBe(true);
    session.nextItem();

    // Item 4: multi-select
    expect(session.currentItem!.item.type).toBe('multi-select');
    const msResult = session.submitAnswer({
      type: 'multi-select',
      selectedIndices: [0, 2],
    });
    expect(msResult.correct).toBe(true);
    session.nextItem();

    // Item 5: two-stage
    expect(session.currentItem!.item.type).toBe('two-stage');
    const tsResult = session.submitAnswer({
      type: 'two-stage',
      selectedIndex: 0,
      followUpSelectedIndex: 0,
    });
    expect(tsResult.correct).toBe(true);
    session.nextItem();

    // Section should be complete
    expect(session.engineState).toBe('sectionComplete');
    expect(session.studentState).not.toBeNull();
    expect(session.progress).not.toBeNull();
  });

  it('handles incorrect answers and shows correct answer in result', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockSectionContent());

    session.nextItem(); // past explanation

    // Wrong answer on multiple-choice
    const result = session.submitAnswer({
      type: 'multiple-choice',
      selectedIndex: 0,
    });
    expect(result.correct).toBe(false);
    expect(result.correctAnswer).toBe('A single piece of functionality');
    expect(session.lastResult!.result.correct).toBe(false);
  });

  it('handles code questions through AI tutor grading', async () => {
    const codeEvaluator: CodeAnswerEvaluator = {
      evaluateCodeAnswer: vi.fn(async () => ({
        verdict: 'partial',
        feedback: 'The function returns false, but the prompt asks for true.',
      })),
    };
    const session = createEngineSession({ apiKey: 'test-key', codeEvaluator });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent([
      {
        type: 'code',
        id: 'q-code',
        topicId: 't1',
        question: 'Write a function that returns true.',
        language: 'typescript',
        initialCode: 'function answer() {}',
        expectedPattern: 'return true',
      } as unknown as ContentItem,
    ]);

    expect(session.currentItem!.item.type).toBe('code');

    const result = await session.submitCodeAnswer({
      type: 'code',
      code: 'function answer() { return false; }',
    });

    expect(codeEvaluator.evaluateCodeAnswer).toHaveBeenCalled();
    expect(result.correct).toBe(false);
    expect(result.codeEvaluation).toEqual({
      verdict: 'partial',
      feedback: 'The function returns false, but the prompt asks for true.',
    });
    expect(session.lastResult!.result.correct).toBe(false);
  });

  it('can skip a question and continue', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockSectionContent());

    session.nextItem(); // past explanation
    expect(session.currentItem!.item.type).toBe('multiple-choice');

    session.skipQuestion();
    // Should advance to numeric-input
    expect(session.currentItem!.item.type).toBe('numeric-input');
  });

  it('persists progress via auto-save after each answer', () => {
    const store = new Map<string, string>();
    const storage: Storage = {
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

    // Create a course in storage first
    const course = createCourse(
      { title: 'Test', curriculum: mockCurriculumPlan() },
      storage
    );

    const session = createEngineSession({
      apiKey: 'test-key',
      courseId: course.id,
      storage,
    });

    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockSectionContent());
    session.nextItem(); // past explanation
    session.submitAnswer({ type: 'multiple-choice', selectedIndex: 1 });

    // Snapshot should be saved with answered state
    const updated = getCourse(course.id, storage);
    expect(updated!.snapshot).not.toBeNull();
    expect(updated!.snapshot!.state).toBe('answered');
  });

  it('navigates from section complete back to ready for next section', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');

    // Minimal content — just one question
    session.setSectionContent([
      {
        type: 'multiple-choice',
        id: 'q1',
        topicId: 't1',
        question: 'Quick question?',
        options: ['A', 'B'],
        correctIndex: 0,
      },
    ]);

    session.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    session.nextItem(); // section complete

    expect(session.engineState).toBe('sectionComplete');

    // Start next section
    session.startSection('s2');
    expect(session.engineState).toBe('loading');
    expect(session.currentSection!.section.id).toBe('s2');
  });
});
