import { describe, expect, it } from 'vitest';
import { summarizeCourseProgress } from '../src/index.js';
import type { CurriculumPlan, StudentState } from '../src/index.js';

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

describe('summarizeCourseProgress', () => {
  it('summarizes course and section progress from engine-owned student state', () => {
    const progress = summarizeCourseProgress(mockCurriculum(), {
      currentSectionIndex: 1,
      studentState: studentStateWith({
        t1: { score: 0.8, answered: 5, correct: 4 },
        t2: { score: 0, answered: 0, correct: 0 },
        t3: { score: 0.6, answered: 3, correct: 2 },
      }),
    });

    expect(progress.currentSectionIndex).toBe(1);
    expect(progress.totalSections).toBe(2);
    expect(progress.totalQuestionsAnswered).toBe(8);
    expect(progress.hasProgress).toBe(true);
    expect(progress.overallMastery).toBeCloseTo(0.7);

    expect(progress.sections[0]).toMatchObject({
      sectionId: 's1',
      title: 'Sorting',
      started: true,
      topicsAttempted: 1,
      topicsTotal: 2,
      mastery: 0.8,
    });
    expect(progress.sections[1]).toMatchObject({
      sectionId: 's2',
      title: 'Searching',
      started: true,
      topicsAttempted: 1,
      topicsTotal: 1,
      mastery: 0.6,
    });
  });

  it('classifies topic display status and review flags using engine thresholds', () => {
    const progress = summarizeCourseProgress(mockCurriculum(), {
      currentSectionIndex: 0,
      studentState: studentStateWith({
        t1: { score: 0.4, answered: 3, correct: 1 },
        t2: { score: 0.9, answered: 6, correct: 6 },
        t3: { score: 0.7, answered: 4, correct: 3 },
      }),
    });

    expect(progress.sections[0].topics[0]).toMatchObject({
      topicId: 't1',
      title: 'Bubble Sort',
      score: 0.4,
      status: 'struggling',
      needsReview: true,
    });
    expect(progress.sections[0].topics[1]).toMatchObject({
      topicId: 't2',
      title: 'Merge Sort',
      score: 0.9,
      status: 'mastered',
      needsReview: false,
    });
    expect(progress.sections[1].topics[0]).toMatchObject({
      topicId: 't3',
      title: 'Binary Search',
      score: 0.7,
      status: 'gaining',
      needsReview: false,
    });
  });
});
