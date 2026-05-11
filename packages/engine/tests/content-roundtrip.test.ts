// --- Content Round-Trip Tests ---
// Verify every supported content item and student-answer type round-trips through:
//   1. ContentCache (deep copy on set/get)
//   2. validateEngineSnapshot (shape validation on import)
//
// Failing one of these tests means a switch somewhere has fallen out of sync
// with the Question union in `content/types.ts`.

import { describe, it, expect } from 'vitest';
import { ContentCache } from '../src/content/ContentCache.js';
import { validateEngineSnapshot } from '../src/export/snapshot-validation.js';
import { SNAPSHOT_VERSION } from '../src/engine/constants.js';
import type {
  ContentItem,
  Question,
  QuestionType,
  StudentAnswer,
} from '../src/content/types.js';
import type { EngineSnapshot } from '../src/engine/types.js';

// --- Fixtures ---
// Every member of the Question union has a fixture below. Plus an explanation.
// If a new question type is added without updating these maps, the test that
// asserts the keyset matches `QuestionType` will fail.

const EXPLANATION: ContentItem = {
  type: 'explanation',
  topicId: 'topic-1',
  title: 'Intro',
  content: 'An explanation paragraph.',
};

const QUESTION_FIXTURES: Record<QuestionType, Question> = {
  'multiple-choice': {
    type: 'multiple-choice',
    id: 'q-mc',
    topicId: 'topic-1',
    question: 'Pick one.',
    options: ['A', 'B', 'C'],
    correctIndex: 1,
  },
  'numeric-input': {
    type: 'numeric-input',
    id: 'q-num',
    topicId: 'topic-1',
    question: 'What is 2+2?',
    correctValue: 4,
    tolerance: 0,
    unit: 'units',
  },
  ordering: {
    type: 'ordering',
    id: 'q-ord',
    topicId: 'topic-1',
    question: 'Sort these.',
    items: ['First', 'Second', 'Third'],
    correctOrder: [0, 1, 2],
  },
  'multi-select': {
    type: 'multi-select',
    id: 'q-ms',
    topicId: 'topic-1',
    question: 'Pick all that apply.',
    options: ['A', 'B', 'C'],
    correctIndices: [0, 2],
  },
  'two-stage': {
    type: 'two-stage',
    id: 'q-ts',
    topicId: 'topic-1',
    question: 'Stage one?',
    options: ['Yes', 'No'],
    correctIndex: 0,
    followUp: 'Why?',
    followUpOptions: ['Because', 'Otherwise'],
    followUpCorrectIndex: 0,
  },
  checklist: {
    type: 'checklist',
    id: 'q-cl',
    topicId: 'topic-1',
    question: 'Complete each step.',
    items: ['Step one', 'Step two', 'Step three'],
  },
  code: {
    type: 'code',
    id: 'q-code',
    topicId: 'topic-1',
    question: 'Write a function.',
    language: 'javascript',
    initialCode: 'function noop() {}',
  },
  'self-evaluation': {
    type: 'self-evaluation',
    id: 'q-se',
    topicId: 'topic-1',
    question: 'How confident are you?',
    options: ['Not at all', 'Somewhat', 'Very'],
  },
};

const ANSWER_FIXTURES: Record<QuestionType, StudentAnswer> = {
  'multiple-choice': { type: 'multiple-choice', selectedIndex: 1 },
  'numeric-input': { type: 'numeric-input', value: 4 },
  ordering: { type: 'ordering', order: [0, 1, 2] },
  'multi-select': { type: 'multi-select', selectedIndices: [0, 2] },
  'two-stage': { type: 'two-stage', selectedIndex: 0, followUpSelectedIndex: 0 },
  checklist: { type: 'checklist', checkedIndices: [0, 1, 2] },
  code: { type: 'code', code: 'function answer() { return 42; }' },
  'self-evaluation': { type: 'self-evaluation', selectedIndex: 2 },
};

const ALL_QUESTION_TYPES = Object.keys(QUESTION_FIXTURES) as QuestionType[];

// --- Snapshot helpers ---

function baseSnapshot(sectionItems: ContentItem[]): EngineSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    state: 'practicing',
    curriculum: {
      title: 'Test Course',
      description: 'A course used by content round-trip tests',
      sections: [
        {
          id: 'section-1',
          title: 'Section 1',
          order: 0,
          topics: [{ id: 'topic-1', title: 'Topic 1', description: 'Topic description' }],
        },
      ],
    },
    currentSectionIndex: 0,
    currentItemIndex: 0,
    sectionItems,
    allGeneratedContent: { 'section-1': sectionItems },
    studentState: { masteryByTopic: {}, gaps: [] },
    lastAnswerResult: null,
  };
}

// --- Fixture-keyset guard ---

describe('Question type fixture coverage', () => {
  it('covers every member of QuestionType', () => {
    // This test forces fixture updates whenever the Question union grows.
    // The expected set should be updated only via QuestionType in types.ts.
    const expected: QuestionType[] = [
      'multiple-choice',
      'numeric-input',
      'ordering',
      'multi-select',
      'two-stage',
      'checklist',
      'code',
      'self-evaluation',
    ];
    expect(new Set(ALL_QUESTION_TYPES)).toEqual(new Set(expected));
    expect(new Set(Object.keys(ANSWER_FIXTURES))).toEqual(new Set(expected));
  });
});

// --- ContentCache round-trip ---

describe('ContentCache round-trip', () => {
  it('round-trips explanations', () => {
    const cache = new ContentCache();
    cache.set('section-1', [EXPLANATION]);
    const restored = cache.get('section-1');
    expect(restored).toEqual([EXPLANATION]);
  });

  it.each(ALL_QUESTION_TYPES)('round-trips %s questions through ContentCache', (type) => {
    const cache = new ContentCache();
    const item = QUESTION_FIXTURES[type];
    cache.set('section-1', [item]);

    const restored = cache.get('section-1');
    expect(restored).toBeDefined();
    expect(restored).toHaveLength(1);
    expect(restored![0]).toEqual(item);
  });

  it('returns defensive copies — mutating get() output does not poison the cache', () => {
    const cache = new ContentCache();
    cache.set('section-1', [QUESTION_FIXTURES.checklist]);

    const first = cache.get('section-1')!;
    expect(first[0].type).toBe('checklist');
    if (first[0].type === 'checklist') {
      first[0].items.push('mutated');
      first[0].items[0] = 'altered';
    }

    const second = cache.get('section-1')!;
    expect(second[0]).toEqual(QUESTION_FIXTURES.checklist);
  });

  it('also returns defensive copies for arrays on every other question type', () => {
    const cache = new ContentCache();
    const itemsWithArrays: Question[] = [
      QUESTION_FIXTURES['multiple-choice'],
      QUESTION_FIXTURES.ordering,
      QUESTION_FIXTURES['multi-select'],
      QUESTION_FIXTURES['two-stage'],
      QUESTION_FIXTURES['self-evaluation'],
    ];

    for (const item of itemsWithArrays) {
      cache.set('section-1', [item]);
      const restored = cache.get('section-1')!;
      // Mutate any string[] field on the restored copy by pushing a sentinel
      const restoredItem = restored[0] as Record<string, unknown>;
      for (const key of Object.keys(restoredItem)) {
        const value = restoredItem[key];
        if (Array.isArray(value)) {
          (value as unknown[]).push('SENTINEL');
        }
      }

      const second = cache.get('section-1')!;
      expect(second[0]).toEqual(item);
    }
  });
});

// --- Snapshot validation ---

describe('validateEngineSnapshot — content items', () => {
  it('accepts a snapshot containing an explanation', () => {
    const snapshot = baseSnapshot([EXPLANATION]);
    expect(validateEngineSnapshot(snapshot)).not.toBeNull();
  });

  it.each(ALL_QUESTION_TYPES)('accepts a snapshot containing a %s question', (type) => {
    const snapshot = baseSnapshot([QUESTION_FIXTURES[type]]);
    expect(validateEngineSnapshot(snapshot)).not.toBeNull();
  });

  it('accepts and strips legacy expectedPattern data from imported code items', () => {
    const legacyCode = {
      ...QUESTION_FIXTURES.code,
      expectedPattern: 'return\\s+true',
    } as unknown as ContentItem;
    const snapshot = baseSnapshot([legacyCode]);

    const restored = validateEngineSnapshot(snapshot);

    expect(restored).not.toBeNull();
    expect(restored!.sectionItems[0]).not.toHaveProperty('expectedPattern');
    expect(restored!.allGeneratedContent['section-1'][0]).not.toHaveProperty(
      'expectedPattern'
    );
  });

  it('rejects a snapshot containing a malformed checklist (missing items array)', () => {
    const broken = { ...QUESTION_FIXTURES.checklist } as Record<string, unknown>;
    delete broken.items;
    const snapshot = baseSnapshot([broken as unknown as ContentItem]);
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });

  it('rejects a snapshot containing a malformed code item (missing language)', () => {
    const broken = { ...QUESTION_FIXTURES.code } as Record<string, unknown>;
    delete broken.language;
    const snapshot = baseSnapshot([broken as unknown as ContentItem]);
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });

  it('rejects a snapshot containing a malformed self-evaluation (options not strings)', () => {
    const broken = {
      ...QUESTION_FIXTURES['self-evaluation'],
      options: [1, 2, 3],
    } as unknown as ContentItem;
    const snapshot = baseSnapshot([broken]);
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });

  it.each([
    [
      'multiple-choice correctIndex outside options',
      {
        ...QUESTION_FIXTURES['multiple-choice'],
        correctIndex: 3,
      } as ContentItem,
    ],
    [
      'multiple-choice correctIndex is not an integer',
      {
        ...QUESTION_FIXTURES['multiple-choice'],
        correctIndex: 1.5,
      } as ContentItem,
    ],
    [
      'numeric-input correctValue is not finite',
      {
        ...QUESTION_FIXTURES['numeric-input'],
        correctValue: Number.POSITIVE_INFINITY,
      } as ContentItem,
    ],
    [
      'numeric-input tolerance is negative',
      {
        ...QUESTION_FIXTURES['numeric-input'],
        tolerance: -0.1,
      } as ContentItem,
    ],
    [
      'ordering correctOrder is not a full permutation',
      {
        ...QUESTION_FIXTURES.ordering,
        correctOrder: [0, 0, 2],
      } as ContentItem,
    ],
    [
      'ordering correctOrder omits an item',
      {
        ...QUESTION_FIXTURES.ordering,
        correctOrder: [0, 1],
      } as ContentItem,
    ],
    [
      'multi-select correctIndices contain duplicates',
      {
        ...QUESTION_FIXTURES['multi-select'],
        correctIndices: [0, 0],
      } as ContentItem,
    ],
    [
      'multi-select correctIndices are outside options',
      {
        ...QUESTION_FIXTURES['multi-select'],
        correctIndices: [0, 3],
      } as ContentItem,
    ],
    [
      'two-stage followUpCorrectIndex is outside follow-up options',
      {
        ...QUESTION_FIXTURES['two-stage'],
        followUpCorrectIndex: 2,
      } as ContentItem,
    ],
  ])('rejects a snapshot containing a question where %s', (_name, item) => {
    const snapshot = baseSnapshot([item]);
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });
});

describe('validateEngineSnapshot — student state and positions', () => {
  it.each([
    [
      'mastery score below 0',
      (snapshot: EngineSnapshot) => {
        snapshot.studentState.masteryByTopic['topic-1'] = {
          topicId: 'topic-1',
          score: -0.01,
          questionsAnswered: 1,
          questionsCorrect: 0,
        };
      },
    ],
    [
      'mastery score above 1',
      (snapshot: EngineSnapshot) => {
        snapshot.studentState.masteryByTopic['topic-1'] = {
          topicId: 'topic-1',
          score: 1.01,
          questionsAnswered: 1,
          questionsCorrect: 1,
        };
      },
    ],
    [
      'questionsAnswered is negative',
      (snapshot: EngineSnapshot) => {
        snapshot.studentState.masteryByTopic['topic-1'] = {
          topicId: 'topic-1',
          score: 0,
          questionsAnswered: -1,
          questionsCorrect: 0,
        };
      },
    ],
    [
      'questionsCorrect exceeds questionsAnswered',
      (snapshot: EngineSnapshot) => {
        snapshot.studentState.masteryByTopic['topic-1'] = {
          topicId: 'topic-1',
          score: 0.5,
          questionsAnswered: 1,
          questionsCorrect: 2,
        };
      },
    ],
  ])('rejects a snapshot where %s', (_name, mutate) => {
    const snapshot = baseSnapshot([EXPLANATION]);
    mutate(snapshot);
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });

  it.each([
    [
      'currentSectionIndex is outside the curriculum',
      (snapshot: EngineSnapshot) => {
        snapshot.currentSectionIndex = 1;
      },
    ],
    [
      'currentItemIndex is outside sectionItems',
      (snapshot: EngineSnapshot) => {
        snapshot.currentItemIndex = snapshot.sectionItems.length;
      },
    ],
    [
      'ready state has an active section and item',
      (snapshot: EngineSnapshot) => {
        snapshot.state = 'ready';
      },
    ],
    [
      'loading state has an active item',
      (snapshot: EngineSnapshot) => {
        snapshot.state = 'loading';
      },
    ],
    [
      'sectionComplete state has not exhausted sectionItems',
      (snapshot: EngineSnapshot) => {
        snapshot.state = 'sectionComplete';
      },
    ],
  ])('rejects a snapshot where %s', (_name, mutate) => {
    const snapshot = baseSnapshot([EXPLANATION]);
    mutate(snapshot);
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });

  it('accepts valid idle, ready, loading, sectionComplete, and complete positions', () => {
    const idleSnapshot: EngineSnapshot = {
      ...baseSnapshot([]),
      state: 'idle',
      curriculum: null,
      currentSectionIndex: -1,
      currentItemIndex: -1,
      allGeneratedContent: {},
    };

    const readySnapshot: EngineSnapshot = {
      ...baseSnapshot([]),
      state: 'ready',
      currentSectionIndex: -1,
      currentItemIndex: -1,
    };

    const loadingSnapshot: EngineSnapshot = {
      ...baseSnapshot([]),
      state: 'loading',
      currentSectionIndex: 0,
      currentItemIndex: -1,
    };

    const sectionCompleteSnapshot: EngineSnapshot = {
      ...baseSnapshot([EXPLANATION]),
      state: 'sectionComplete',
      currentItemIndex: 1,
    };

    const completeSnapshot: EngineSnapshot = {
      ...baseSnapshot([EXPLANATION]),
      state: 'complete',
      currentItemIndex: 1,
    };

    expect(validateEngineSnapshot(idleSnapshot)).not.toBeNull();
    expect(validateEngineSnapshot(readySnapshot)).not.toBeNull();
    expect(validateEngineSnapshot(loadingSnapshot)).not.toBeNull();
    expect(validateEngineSnapshot(sectionCompleteSnapshot)).not.toBeNull();
    expect(validateEngineSnapshot(completeSnapshot)).not.toBeNull();
  });
});

// --- Snapshot validation — student answers via lastAnswerResult ---

describe('validateEngineSnapshot — student answers', () => {
  it.each(ALL_QUESTION_TYPES)(
    'accepts a snapshot with a %s answer in lastAnswerResult',
    (type) => {
      const snapshot = baseSnapshot([EXPLANATION]);
      snapshot.lastAnswerResult = {
        correct: true,
        questionId: 'q-test',
        topicId: 'topic-1',
        userAnswer: ANSWER_FIXTURES[type],
        correctAnswer: 'human-readable description',
      };
      expect(validateEngineSnapshot(snapshot)).not.toBeNull();
    }
  );

  it('rejects a snapshot with a malformed checklist answer (checkedIndices not numbers)', () => {
    const snapshot = baseSnapshot([EXPLANATION]);
    snapshot.lastAnswerResult = {
      correct: true,
      questionId: 'q-test',
      topicId: 'topic-1',
      userAnswer: {
        type: 'checklist',
        checkedIndices: ['nope'] as unknown as number[],
      },
      correctAnswer: 'desc',
    };
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });

  it('rejects a snapshot with a malformed code answer (code not a string)', () => {
    const snapshot = baseSnapshot([EXPLANATION]);
    snapshot.lastAnswerResult = {
      correct: true,
      questionId: 'q-test',
      topicId: 'topic-1',
      userAnswer: { type: 'code', code: 42 as unknown as string },
      correctAnswer: 'desc',
    };
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });

  it('rejects a snapshot with a malformed self-evaluation answer (selectedIndex missing)', () => {
    const snapshot = baseSnapshot([EXPLANATION]);
    snapshot.lastAnswerResult = {
      correct: true,
      questionId: 'q-test',
      topicId: 'topic-1',
      userAnswer: { type: 'self-evaluation' } as unknown as StudentAnswer,
      correctAnswer: 'desc',
    };
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });

  it.each([
    [
      'multiple-choice selectedIndex is negative',
      { type: 'multiple-choice', selectedIndex: -1 } as StudentAnswer,
    ],
    [
      'ordering order contains duplicate indices',
      { type: 'ordering', order: [0, 0] } as StudentAnswer,
    ],
    [
      'multi-select selectedIndices are not integers',
      { type: 'multi-select', selectedIndices: [0.5] } as StudentAnswer,
    ],
    [
      'numeric-input value is not finite',
      { type: 'numeric-input', value: Number.NaN } as StudentAnswer,
    ],
  ])('rejects a snapshot with a malformed answer where %s', (_name, userAnswer) => {
    const snapshot = baseSnapshot([EXPLANATION]);
    snapshot.lastAnswerResult = {
      correct: true,
      questionId: 'q-test',
      topicId: 'topic-1',
      userAnswer,
      correctAnswer: 'desc',
    };
    expect(validateEngineSnapshot(snapshot)).toBeNull();
  });
});
