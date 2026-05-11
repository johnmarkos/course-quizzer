import { describe, expect, it } from 'vitest';
import { SNAPSHOT_VERSION, summarizeCourseProgress } from '../src/index.js';
import type { CurriculumPlan, EngineSnapshot, StudentState } from '../src/index.js';

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
    ],
  };
}

function studentStateWith(
  topics: Record<string, { score: number; answered: number; correct: number }>
): StudentState {
  const masteryByTopic: StudentState['masteryByTopic'] = {};
  for (const [topicId, data] of Object.entries(topics)) {
    masteryByTopic[topicId] = {
      topicId,
      score: data.score,
      questionsAnswered: data.answered,
      questionsCorrect: data.correct,
    };
  }

  return { masteryByTopic, gaps: [] };
}

function mockSnapshot(overrides?: Partial<EngineSnapshot>): EngineSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    state: 'ready',
    curriculum: mockCurriculum(),
    currentSectionIndex: 0,
    currentItemIndex: -1,
    sectionItems: [],
    allGeneratedContent: {},
    studentState: { masteryByTopic: {}, gaps: [] },
    lastAnswerResult: null,
    ...overrides,
  };
}

describe('summarizeCourseProgress', () => {
  it('returns null when no snapshot exists', () => {
    expect(summarizeCourseProgress(mockCurriculum(), null)).toBeNull();
  });

  it('summarizes course and section progress from engine snapshots', () => {
    const progress = summarizeCourseProgress(
      mockCurriculum(),
      mockSnapshot({
        currentSectionIndex: 1,
        studentState: studentStateWith({
          t1: { score: 0.8, answered: 5, correct: 4 },
          t2: { score: 0, answered: 0, correct: 0 },
          t3: { score: 0.6, answered: 3, correct: 2 },
        }),
      })
    );

    expect(progress).not.toBeNull();
    expect(progress!.currentSectionIndex).toBe(1);
    expect(progress!.totalSections).toBe(2);
    expect(progress!.totalQuestionsAnswered).toBe(8);
    expect(progress!.hasProgress).toBe(true);
    expect(progress!.overallMastery).toBeCloseTo(0.7);
    expect(progress!.overallMasteryPercent).toBe(70);

    expect(progress!.sections[0]).toMatchObject({
      sectionId: 's1',
      started: true,
      topicsAttempted: 1,
      topicsTotal: 2,
      mastery: 0.8,
      masteryPercent: 80,
    });
    expect(progress!.sections[1]).toMatchObject({
      sectionId: 's2',
      started: true,
      topicsAttempted: 1,
      topicsTotal: 1,
      mastery: 0.6,
      masteryPercent: 60,
    });
  });
});
