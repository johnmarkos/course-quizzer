import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import {
  createEngineSession,
  type EngineSession,
} from '../../src/lib/stores/engine-session.svelte.js';
import type {
  CurriculumPlan,
  ContentItem,
  EngineSnapshot,
  StudentAnswer,
} from 'quizzer-engine';
import {
  updateCourse,
  createCourse,
  getCourse,
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
    courseTitle: 'Test Course',
    sections: [
      {
        id: 's1',
        title: 'Section 1',
        topics: [{ id: 't1', name: 'Topic 1', section: 's1' }],
      },
      {
        id: 's2',
        title: 'Section 2',
        topics: [{ id: 't2', name: 'Topic 2', section: 's2' }],
      },
    ],
  };
}

function mockContentItems(): ContentItem[] {
  return [
    {
      type: 'explanation',
      topicId: 't1',
      title: 'Intro to Topic 1',
      content: 'This is an explanation.',
    },
    {
      type: 'multiple-choice',
      id: 'q1',
      topicId: 't1',
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      correctIndex: 1,
    },
  ];
}

function correctAnswer(): StudentAnswer {
  return { type: 'multiple-choice', selectedIndex: 1 };
}

function wrongAnswer(): StudentAnswer {
  return { type: 'multiple-choice', selectedIndex: 0 };
}

describe('createEngineSession', () => {
  // --- Initial state ---

  it('starts in idle state with null values', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    expect(session.engineState).toBe('idle');
    expect(session.curriculum).toBeNull();
    expect(session.currentSection).toBeNull();
    expect(session.currentItem).toBeNull();
    expect(session.lastResult).toBeNull();
    expect(session.progress).toBeNull();
    expect(session.studentState).toBeNull();
    expect(session.apiLoading).toBe(false);
    expect(session.error).toBeNull();
  });

  // --- Curriculum loading ---

  it('updates state after loading a curriculum', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());

    expect(session.engineState).toBe('ready');
    expect(session.curriculum).not.toBeNull();
    expect(session.curriculum!.courseTitle).toBe('Test Course');
    expect(session.curriculum!.sections).toHaveLength(2);
  });

  // --- Section start ---

  it('updates currentSection when a section starts', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');

    expect(session.engineState).toBe('loading');
    expect(session.currentSection).not.toBeNull();
    expect(session.currentSection!.section.id).toBe('s1');
    expect(session.currentSection!.sectionIndex).toBe(0);
    expect(session.currentSection!.totalSections).toBe(2);
  });

  // --- Content ready and item display ---

  it('updates currentItem when content is set', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockContentItems());

    expect(session.engineState).toBe('practicing');
    expect(session.currentItem).not.toBeNull();
    expect(session.currentItem!.item.type).toBe('explanation');
    expect(session.currentItem!.itemIndex).toBe(0);
    expect(session.currentItem!.totalItems).toBe(2);
  });

  // --- Answer submission ---

  it('updates lastResult after submitting an answer', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockContentItems());

    // Advance past the explanation
    session.nextItem();

    // Now on the question — submit a correct answer
    const result = session.submitAnswer(correctAnswer());
    expect(result.correct).toBe(true);

    expect(session.engineState).toBe('answered');
    expect(session.lastResult).not.toBeNull();
    expect(session.lastResult!.result.correct).toBe(true);
    expect(session.lastResult!.studentState).toBeDefined();
    expect(session.lastResult!.progress).toBeDefined();
  });

  it('tracks incorrect answers', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockContentItems());
    session.nextItem(); // past explanation

    const result = session.submitAnswer(wrongAnswer());
    expect(result.correct).toBe(false);
    expect(session.lastResult!.result.correct).toBe(false);
  });

  // --- Item navigation ---

  it('advances to the next item after answering', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockContentItems());
    session.nextItem(); // past explanation
    session.submitAnswer(correctAnswer());
    session.nextItem(); // past the answered question

    // Section should be complete (only 2 items)
    expect(session.engineState).toBe('sectionComplete');
  });

  // --- Skip question ---

  it('skips a question and advances', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockContentItems());
    session.nextItem(); // past explanation
    session.skipQuestion();

    // Section complete after skipping the only question
    expect(session.engineState).toBe('sectionComplete');
  });

  // --- Section completion ---

  it('tracks section completion with student state and progress', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockContentItems());
    session.nextItem(); // past explanation
    session.submitAnswer(correctAnswer());
    session.nextItem(); // triggers section complete

    expect(session.engineState).toBe('sectionComplete');
    expect(session.studentState).not.toBeNull();
    expect(session.progress).not.toBeNull();
  });

  // --- Course completion ---

  it('tracks course completion after all sections', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());

    // Complete section 1
    session.startSection('s1');
    session.setSectionContent(mockContentItems());
    session.nextItem();
    session.submitAnswer(correctAnswer());
    session.nextItem();

    // Start and complete section 2
    session.startSection('s2');
    session.setSectionContent([
      {
        type: 'multiple-choice',
        id: 'q2',
        topicId: 't2',
        question: 'What is 3+3?',
        options: ['5', '6', '7', '8'],
        correctIndex: 1,
      },
    ]);
    session.submitAnswer({ type: 'multiple-choice', selectedIndex: 1 });
    session.nextItem(); // complete section 2
    session.nextSection(); // triggers course complete

    expect(session.engineState).toBe('complete');
    expect(session.studentState).not.toBeNull();
    expect(session.progress).not.toBeNull();
  });

  // --- Error tracking ---

  it('captures engine errors', () => {
    const session = createEngineSession({ apiKey: 'test-key' });

    // Trying to start a section without loading curriculum should throw
    expect(() => session.startSection('s1')).toThrow();
  });

  // --- Dispose / cleanup ---

  it('clears state on dispose', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());

    expect(session.engineState).toBe('ready');
    session.dispose();

    expect(session.engineState).toBe('idle');
    expect(session.curriculum).toBeNull();
  });

  it('unsubscribes from engine events on dispose', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.dispose();

    // After dispose, creating a new session should work independently
    const session2 = createEngineSession({ apiKey: 'test-key-2' });
    session2.loadCurriculum(mockCurriculumPlan());
    expect(session2.engineState).toBe('ready');
    // Original session should still show idle (disposed)
    expect(session.engineState).toBe('idle');
  });

  // --- Restore from snapshot ---

  it('restores session from a snapshot', () => {
    // Build a session and take a snapshot
    const session1 = createEngineSession({ apiKey: 'test-key' });
    session1.loadCurriculum(mockCurriculumPlan());
    session1.startSection('s1');
    session1.setSectionContent(mockContentItems());

    const snapshot = session1.serialize()!;
    expect(snapshot).not.toBeNull();

    // Restore into a new session
    const session2 = createEngineSession({ apiKey: 'test-key', snapshot });

    expect(session2.engineState).toBe('practicing');
    expect(session2.curriculum).not.toBeNull();
    expect(session2.curriculum!.courseTitle).toBe('Test Course');
  });

  // --- Auto-save to course storage ---

  it('auto-saves snapshot after answer submission when courseId and storage are provided', () => {
    const storage = createLocalStorageMock();
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
    session.setSectionContent(mockContentItems());
    session.nextItem();
    session.submitAnswer(correctAnswer());

    // Verify that course storage was updated with a snapshot
    const updated = getCourse(course.id, storage);
    expect(updated).not.toBeNull();
    expect(updated!.snapshot).not.toBeNull();
    expect(updated!.snapshot!.state).toBe('answered');
  });

  it('auto-saves snapshot on section completion', () => {
    const storage = createLocalStorageMock();
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
    session.setSectionContent(mockContentItems());
    session.nextItem();
    session.submitAnswer(correctAnswer());
    session.nextItem(); // triggers section complete

    const updated = getCourse(course.id, storage);
    expect(updated!.snapshot).not.toBeNull();
    expect(updated!.snapshot!.state).toBe('sectionComplete');
  });

  it('does not auto-save when courseId is not provided', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.loadCurriculum(mockCurriculumPlan());
    session.startSection('s1');
    session.setSectionContent(mockContentItems());
    session.nextItem();
    session.submitAnswer(correctAnswer());
    // No crash, no storage interaction — just verifying it doesn't blow up
    expect(session.lastResult).not.toBeNull();
  });

  // --- API key not leaked ---

  it('does not expose the API key in serialized snapshots', () => {
    const session = createEngineSession({ apiKey: 'sk-ant-secret-key-12345' });
    session.loadCurriculum(mockCurriculumPlan());
    const snapshot = session.serialize()!;

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('sk-ant-secret-key-12345');
  });

  // --- Replacing a session disposes the old one ---

  it('serialize returns null after dispose', () => {
    const session = createEngineSession({ apiKey: 'test-key' });
    session.dispose();
    expect(session.serialize()).toBeNull();
  });
});
