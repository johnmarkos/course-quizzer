import { describe, it, expect } from 'vitest';
import { StudentModel } from '../src/index.js';
import type { Section, StudentState } from '../src/index.js';

// --- Helpers ---

function modelWithTopics(...topicIds: string[]): StudentModel {
  const model = new StudentModel();
  for (const id of topicIds) {
    model.initializeTopic(id);
  }
  return model;
}

// --- Initialization ---

describe('StudentModel initialization', () => {
  it('starts with no topics', () => {
    const model = new StudentModel();
    expect(model.topicCount).toBe(0);
    expect(model.overallMastery).toBe(0);
    expect(model.gaps).toEqual([]);
  });

  it('initializes topics with zero mastery', () => {
    const model = modelWithTopics('topic-1', 'topic-2');

    expect(model.topicCount).toBe(2);
    const mastery = model.getTopicMastery('topic-1');
    expect(mastery).toBeDefined();
    expect(mastery!.score).toBe(0);
    expect(mastery!.questionsAnswered).toBe(0);
    expect(mastery!.questionsCorrect).toBe(0);
  });

  it('skips duplicate topic initialization', () => {
    const model = new StudentModel();
    model.initializeTopic('topic-1');
    // Answer a question to change the mastery
    model.recordAnswer({ topicId: 'topic-1', correct: true });

    // Re-initialize should not reset
    model.initializeTopic('topic-1');
    expect(model.getTopicMastery('topic-1')!.score).toBeGreaterThan(0);
    expect(model.topicCount).toBe(1);
  });

  it('marks new topics as gaps (score 0 < threshold)', () => {
    const model = modelWithTopics('topic-1');
    expect(model.gaps).toContain('topic-1');
  });
});

// --- Mastery Updates ---

describe('mastery calculations', () => {
  it('increases mastery on correct answer', () => {
    const model = modelWithTopics('topic-1');

    const updated = model.recordAnswer({ topicId: 'topic-1', correct: true });

    expect(updated.score).toBe(0.15);
    expect(updated.questionsAnswered).toBe(1);
    expect(updated.questionsCorrect).toBe(1);
  });

  it('decreases mastery on incorrect answer', () => {
    const model = modelWithTopics('topic-1');
    // First get some mastery
    model.recordAnswer({ topicId: 'topic-1', correct: true });
    model.recordAnswer({ topicId: 'topic-1', correct: true });
    const before = model.getTopicMastery('topic-1')!.score;

    const updated = model.recordAnswer({ topicId: 'topic-1', correct: false });

    expect(updated.score).toBe(before - 0.1);
    expect(updated.questionsAnswered).toBe(3);
    expect(updated.questionsCorrect).toBe(2);
  });

  it('mastery does not go below 0', () => {
    const model = modelWithTopics('topic-1');

    // Multiple incorrect answers from 0
    model.recordAnswer({ topicId: 'topic-1', correct: false });
    model.recordAnswer({ topicId: 'topic-1', correct: false });
    model.recordAnswer({ topicId: 'topic-1', correct: false });

    expect(model.getTopicMastery('topic-1')!.score).toBe(0);
  });

  it('mastery does not exceed 1', () => {
    const model = modelWithTopics('topic-1');

    // 10 correct answers: 10 * 0.15 = 1.5, but clamped to 1
    for (let i = 0; i < 10; i++) {
      model.recordAnswer({ topicId: 'topic-1', correct: true });
    }

    expect(model.getTopicMastery('topic-1')!.score).toBe(1);
  });

  it('throws for untracked topic', () => {
    const model = new StudentModel();

    expect(() => model.recordAnswer({ topicId: 'nonexistent', correct: true })).toThrow(
      'not tracked'
    );
  });

  it('returns a defensive copy from recordAnswer', () => {
    const model = modelWithTopics('topic-1');

    const result = model.recordAnswer({ topicId: 'topic-1', correct: true });
    result.score = 999;

    expect(model.getTopicMastery('topic-1')!.score).toBe(0.15);
  });
});

// --- Gap Detection ---

describe('gap detection', () => {
  it('tracks topics below threshold as gaps', () => {
    const model = modelWithTopics('topic-1', 'topic-2');
    // Both start at 0, both are gaps
    expect(model.gaps).toContain('topic-1');
    expect(model.gaps).toContain('topic-2');
  });

  it('removes topic from gaps when mastery reaches threshold', () => {
    const model = modelWithTopics('topic-1');

    // 4 correct answers: 4 * 0.15 = 0.60, above 0.5 threshold
    for (let i = 0; i < 4; i++) {
      model.recordAnswer({ topicId: 'topic-1', correct: true });
    }

    expect(model.gaps).not.toContain('topic-1');
  });

  it('re-adds topic to gaps when mastery drops below threshold', () => {
    const model = modelWithTopics('topic-1');

    // Get above threshold
    for (let i = 0; i < 4; i++) {
      model.recordAnswer({ topicId: 'topic-1', correct: true });
    }
    expect(model.gaps).not.toContain('topic-1');

    // Drop back below: 0.60 - 0.10 = 0.50 — at threshold, not below
    model.recordAnswer({ topicId: 'topic-1', correct: false });
    expect(model.gaps).not.toContain('topic-1');

    // One more: 0.50 - 0.10 = 0.40 — below threshold
    model.recordAnswer({ topicId: 'topic-1', correct: false });
    expect(model.gaps).toContain('topic-1');
  });
});

// --- Overall Mastery ---

describe('overall mastery', () => {
  it('computes average across all topics', () => {
    const model = modelWithTopics('topic-1', 'topic-2');

    // topic-1: 1 correct = 0.15
    model.recordAnswer({ topicId: 'topic-1', correct: true });
    // topic-2: stays at 0

    expect(model.overallMastery).toBeCloseTo(0.075, 5);
  });

  it('returns 0 with no topics', () => {
    const model = new StudentModel();
    expect(model.overallMastery).toBe(0);
  });
});

// --- Session Progress ---

describe('session progress', () => {
  it('computes progress with position data', () => {
    const model = modelWithTopics('topic-1');
    model.recordAnswer({ topicId: 'topic-1', correct: true });

    const progress = model.computeProgress({
      currentSectionIndex: 1,
      totalSections: 5,
      currentItemIndex: 3,
      totalItemsInSection: 10,
    });

    expect(progress.currentSectionIndex).toBe(1);
    expect(progress.totalSections).toBe(5);
    expect(progress.currentItemIndex).toBe(3);
    expect(progress.totalItemsInSection).toBe(10);
    expect(progress.overallMastery).toBe(0.15);
  });

  it('includes current section topic progress for UI display', () => {
    const state: StudentState = {
      masteryByTopic: {
        'topic-1': {
          topicId: 'topic-1',
          score: 0.4,
          questionsAnswered: 3,
          questionsCorrect: 1,
        },
        'topic-2': {
          topicId: 'topic-2',
          score: 0.85,
          questionsAnswered: 6,
          questionsCorrect: 5,
        },
      },
      gaps: ['topic-1'],
    };
    const model = new StudentModel(state);
    const section: Section = {
      id: 'section-1',
      title: 'Unit Testing',
      order: 0,
      topics: [
        { id: 'topic-1', title: 'Assertions', description: 'How to assert' },
        { id: 'topic-2', title: 'Mocks', description: 'How to mock' },
      ],
    };

    const progress = model.computeProgress({
      currentSectionIndex: 0,
      totalSections: 2,
      currentItemIndex: 4,
      totalItemsInSection: 8,
      currentSection: section,
    });

    expect(progress.currentSection).toMatchObject({
      sectionId: 'section-1',
      title: 'Unit Testing',
      topicsAttempted: 2,
      topicsTotal: 2,
      mastery: 0.625,
    });
    expect(progress.currentSection!.topics[0]).toMatchObject({
      topicId: 'topic-1',
      title: 'Assertions',
      status: 'struggling',
      needsReview: true,
    });
    expect(progress.currentSection!.topics[1]).toMatchObject({
      topicId: 'topic-2',
      title: 'Mocks',
      status: 'mastered',
      needsReview: false,
    });
  });
});

// --- Serialization ---

describe('serialize / restore', () => {
  it('round-trips student state', () => {
    const model = modelWithTopics('topic-1', 'topic-2');
    model.recordAnswer({ topicId: 'topic-1', correct: true });
    model.recordAnswer({ topicId: 'topic-2', correct: false });

    const state = model.getState();
    const restored = new StudentModel(state);

    expect(restored.getTopicMastery('topic-1')!.score).toBe(0.15);
    expect(restored.getTopicMastery('topic-2')!.score).toBe(0);
    expect(restored.gaps).toContain('topic-2');
    expect(restored.topicCount).toBe(2);
  });

  it('restored model can continue recording answers', () => {
    const model = modelWithTopics('topic-1');
    model.recordAnswer({ topicId: 'topic-1', correct: true });

    const state = model.getState();
    const restored = new StudentModel(state);
    restored.recordAnswer({ topicId: 'topic-1', correct: true });

    expect(restored.getTopicMastery('topic-1')!.score).toBe(0.3);
    expect(restored.getTopicMastery('topic-1')!.questionsAnswered).toBe(2);
  });

  it('getState returns defensive copies', () => {
    const model = modelWithTopics('topic-1');
    model.recordAnswer({ topicId: 'topic-1', correct: true });

    const state1 = model.getState();
    state1.gaps.push('fake-gap');
    state1.masteryByTopic['topic-1'].score = 999;

    const state2 = model.getState();
    expect(state2.gaps).not.toContain('fake-gap');
    expect(state2.masteryByTopic['topic-1'].score).toBe(0.15);
  });

  it('constructor does not mutate the input state', () => {
    const state: StudentState = {
      masteryByTopic: {
        'topic-1': {
          topicId: 'topic-1',
          score: 0.5,
          questionsAnswered: 3,
          questionsCorrect: 2,
        },
      },
      gaps: [],
    };

    const model = new StudentModel(state);
    model.recordAnswer({ topicId: 'topic-1', correct: true });

    // Original state should be unmodified
    expect(state.masteryByTopic['topic-1'].score).toBe(0.5);
  });
});

// --- getTopicMastery ---

describe('getTopicMastery', () => {
  it('returns undefined for untracked topic', () => {
    const model = new StudentModel();
    expect(model.getTopicMastery('nonexistent')).toBeUndefined();
  });

  it('returns a defensive copy', () => {
    const model = modelWithTopics('topic-1');

    const mastery = model.getTopicMastery('topic-1')!;
    mastery.score = 999;

    expect(model.getTopicMastery('topic-1')!.score).toBe(0);
  });
});
