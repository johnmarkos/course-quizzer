import { describe, it, expect } from 'vitest';
import {
  getCourseProgress,
  formatMastery,
  getProgressLabel,
} from '../../src/lib/stores/course-progress.js';
import type { CourseRecord } from '../../src/lib/storage/course-storage.js';
import type { CurriculumPlan, EngineSnapshot, StudentState } from 'quizzer-engine';

// --- Fixtures ---

function mockCurriculum(): CurriculumPlan {
  return {
    title: 'Algorithms',
    description: 'An intro to algorithms.',
    sections: [
      {
        id: 's1',
        title: 'Sorting',
        order: 0,
        topics: [
          { id: 't1', title: 'Bubble Sort', description: 'The simplest sort.' },
          { id: 't2', title: 'Merge Sort', description: 'Divide and conquer.' },
        ],
      },
      {
        id: 's2',
        title: 'Searching',
        order: 1,
        topics: [{ id: 't3', title: 'Binary Search', description: 'Log-time search.' }],
      },
      {
        id: 's3',
        title: 'Graphs',
        order: 2,
        topics: [
          { id: 't4', title: 'BFS', description: 'Breadth-first search.' },
          { id: 't5', title: 'DFS', description: 'Depth-first search.' },
        ],
      },
    ],
  };
}

function mockRecord(overrides?: Partial<CourseRecord>): CourseRecord {
  return {
    id: 'course-1',
    title: 'Algorithms',
    curriculum: mockCurriculum(),
    snapshot: null,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
    ...overrides,
  };
}

function mockSnapshot(overrides?: Partial<EngineSnapshot>): EngineSnapshot {
  return {
    version: 3,
    state: 'ready',
    curriculum: mockCurriculum(),
    currentSectionIndex: 0,
    currentItemIndex: 0,
    sectionItems: [],
    studentState: { masteryByTopic: {}, gaps: [] },
    lastAnswerResult: null,
    ...overrides,
  };
}

function studentStateWith(
  topics: Record<string, { score: number; answered: number; correct: number }>
): StudentState {
  const masteryByTopic: Record<
    string,
    {
      topicId: string;
      score: number;
      questionsAnswered: number;
      questionsCorrect: number;
    }
  > = {};
  for (const [id, data] of Object.entries(topics)) {
    masteryByTopic[id] = {
      topicId: id,
      score: data.score,
      questionsAnswered: data.answered,
      questionsCorrect: data.correct,
    };
  }
  return { masteryByTopic, gaps: [] };
}

// --- getCourseProgress ---

describe('getCourseProgress', () => {
  it('returns null when course has no snapshot', () => {
    const record = mockRecord({ snapshot: null });
    expect(getCourseProgress(record)).toBeNull();
  });

  it('returns a summary with zero progress when snapshot has no answered questions', () => {
    const record = mockRecord({ snapshot: mockSnapshot() });
    const progress = getCourseProgress(record);

    expect(progress).not.toBeNull();
    expect(progress!.hasProgress).toBe(false);
    expect(progress!.overallMastery).toBe(0);
    expect(progress!.totalQuestionsAnswered).toBe(0);
    expect(progress!.totalSections).toBe(3);
    expect(progress!.currentSectionIndex).toBe(0);
  });

  it('computes per-section progress from student state', () => {
    const state = studentStateWith({
      t1: { score: 0.8, answered: 5, correct: 4 },
      t2: { score: 0.6, answered: 3, correct: 2 },
    });
    const snapshot = mockSnapshot({
      currentSectionIndex: 1,
      studentState: state,
    });
    const record = mockRecord({ snapshot });
    const progress = getCourseProgress(record)!;

    // Section 1 (s1): both topics attempted
    expect(progress.sections[0].started).toBe(true);
    expect(progress.sections[0].topicsAttempted).toBe(2);
    expect(progress.sections[0].topicsTotal).toBe(2);
    expect(progress.sections[0].mastery).toBeCloseTo(0.7); // avg of 0.8 and 0.6

    // Section 2 (s2): no topics attempted, but index < currentSectionIndex is false (index=1, current=1)
    expect(progress.sections[1].started).toBe(false);
    expect(progress.sections[1].topicsAttempted).toBe(0);

    // Section 3 (s3): not started
    expect(progress.sections[2].started).toBe(false);
    expect(progress.sections[2].topicsAttempted).toBe(0);
  });

  it('marks earlier sections as started based on currentSectionIndex', () => {
    const snapshot = mockSnapshot({ currentSectionIndex: 2 });
    const record = mockRecord({ snapshot });
    const progress = getCourseProgress(record)!;

    // Sections 0 and 1 are before currentSectionIndex
    expect(progress.sections[0].started).toBe(true);
    expect(progress.sections[1].started).toBe(true);
    expect(progress.sections[2].started).toBe(false);
  });

  it('computes overall mastery across all attempted topics', () => {
    const state = studentStateWith({
      t1: { score: 1.0, answered: 5, correct: 5 },
      t3: { score: 0.5, answered: 4, correct: 2 },
    });
    const snapshot = mockSnapshot({
      currentSectionIndex: 1,
      studentState: state,
    });
    const record = mockRecord({ snapshot });
    const progress = getCourseProgress(record)!;

    expect(progress.overallMastery).toBeCloseTo(0.75); // avg of 1.0 and 0.5
    expect(progress.totalQuestionsAnswered).toBe(9); // 5 + 4
    expect(progress.hasProgress).toBe(true);
  });

  it('excludes unattempted topics from overall mastery', () => {
    const state: StudentState = {
      masteryByTopic: {
        t1: { topicId: 't1', score: 0.8, questionsAnswered: 5, questionsCorrect: 4 },
        t2: { topicId: 't2', score: 0, questionsAnswered: 0, questionsCorrect: 0 },
        t3: { topicId: 't3', score: 0.6, questionsAnswered: 3, questionsCorrect: 2 },
      },
      gaps: [],
    };
    const snapshot = mockSnapshot({
      currentSectionIndex: 1,
      studentState: state,
    });
    const record = mockRecord({ snapshot });
    const progress = getCourseProgress(record)!;

    // Only t1 (0.8) and t3 (0.6) are attempted — t2 has 0 answers and must not drag the average down
    expect(progress.overallMastery).toBeCloseTo(0.7); // avg of 0.8 and 0.6, not (0.8 + 0 + 0.6) / 3
    expect(progress.totalQuestionsAnswered).toBe(8); // 5 + 3
  });
});

// --- formatMastery ---

describe('formatMastery', () => {
  it('formats 0 as 0%', () => {
    expect(formatMastery(0)).toBe('0%');
  });

  it('formats 1 as 100%', () => {
    expect(formatMastery(1)).toBe('100%');
  });

  it('rounds to nearest integer', () => {
    expect(formatMastery(0.756)).toBe('76%');
    expect(formatMastery(0.333)).toBe('33%');
  });
});

// --- getProgressLabel ---

describe('getProgressLabel', () => {
  it('returns "Not started" for a course with no snapshot', () => {
    expect(getProgressLabel(mockRecord())).toBe('Not started');
  });

  it('returns "Not started" for a snapshot with no answered questions', () => {
    const record = mockRecord({ snapshot: mockSnapshot() });
    expect(getProgressLabel(record)).toBe('Not started');
  });

  it('returns section progress label when in progress', () => {
    const state = studentStateWith({
      t1: { score: 0.75, answered: 4, correct: 3 },
    });
    const snapshot = mockSnapshot({
      currentSectionIndex: 0,
      studentState: state,
    });
    const record = mockRecord({ snapshot });
    expect(getProgressLabel(record)).toBe('Section 1/3 · 75% mastery');
  });

  it('returns complete label when all sections done', () => {
    const state = studentStateWith({
      t1: { score: 0.9, answered: 5, correct: 4 },
    });
    const snapshot = mockSnapshot({
      currentSectionIndex: 3, // past last section
      studentState: state,
    });
    const record = mockRecord({ snapshot });
    expect(getProgressLabel(record)).toBe('Complete · 90% mastery');
  });
});
