import { describe, it, expect, vi } from 'vitest';
import { CourseEngine, InvalidTransitionError } from '../src/index.js';
import type {
  EngineEventMap,
  CurriculumPlan,
  ContentItem,
  StudentAnswer,
} from '../src/index.js';

// --- Test Data Factories ---

function mockCurriculum(): CurriculumPlan {
  return {
    title: 'Intro to Testing',
    description: 'A course about testing',
    sections: [
      {
        id: 'section-1',
        title: 'Unit Testing',
        order: 0,
        topics: [
          { id: 'topic-1', title: 'Assertions', description: 'How to assert' },
          { id: 'topic-2', title: 'Mocking', description: 'How to mock' },
        ],
      },
      {
        id: 'section-2',
        title: 'Integration Testing',
        order: 1,
        topics: [{ id: 'topic-3', title: 'Setup', description: 'Test setup' }],
      },
    ],
  };
}

function mockSectionContent(): ContentItem[] {
  return [
    {
      type: 'explanation',
      topicId: 'topic-1',
      title: 'Understanding Assertions',
      content: 'Assertions verify expected behavior.',
    },
    {
      type: 'multiple-choice',
      id: 'q1',
      topicId: 'topic-1',
      question: 'What does assertEquals do?',
      options: ['Compares values', 'Logs output', 'Throws always', 'Does nothing'],
      correctIndex: 0,
    },
    {
      type: 'numeric-input',
      id: 'q2',
      topicId: 'topic-1',
      question: 'What is 2 + 2?',
      correctValue: 4,
      tolerance: 0,
    },
    {
      type: 'ordering',
      id: 'q3',
      topicId: 'topic-2',
      question: 'Order the test phases:',
      items: ['Assert', 'Arrange', 'Act'],
      correctOrder: [1, 2, 0], // Arrange, Act, Assert
    },
    {
      type: 'multi-select',
      id: 'q4',
      topicId: 'topic-2',
      question: 'Select all testing frameworks:',
      options: ['Vitest', 'Photoshop', 'Jest', 'Excel'],
      correctIndices: [0, 2],
    },
    {
      type: 'two-stage',
      id: 'q5',
      topicId: 'topic-2',
      question: 'What is a mock?',
      options: ['A fake object', 'A real database', 'A CSS file'],
      correctIndex: 0,
      followUp: 'Why use mocks?',
      followUpOptions: ['Isolation', 'Performance', 'Styling'],
      followUpCorrectIndex: 0,
    },
  ];
}

function collectEvents<E extends keyof EngineEventMap>(
  engine: CourseEngine,
  event: E
): EngineEventMap[E][] {
  const events: EngineEventMap[E][] = [];
  engine.on(event, (payload) => events.push(payload));
  return events;
}

const mockGenerator = {
  generateTopicExplanation: () => new Promise(() => {}), // never resolves
  generateTopicQuizBurst: () => new Promise(() => {}),
};

function engineAtPracticing(): {
  engine: CourseEngine;
  items: ContentItem[];
} {
  const items = mockSectionContent();
  const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
  engine.loadCurriculum(mockCurriculum());
  engine.startSection('section-1');
  engine.setSectionContent(items);
  return { engine, items };
}

// --- Constructor ---

describe('CourseEngine', () => {
  it('starts in idle state', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    expect(engine.state).toBe('idle');
  });

  it('has no curriculum initially', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    expect(engine.curriculum).toBeNull();
    expect(engine.currentSection).toBeNull();
    expect(engine.currentItem).toBeNull();
  });
});

// --- State Transitions ---

describe('state machine transitions', () => {
  it('idle → ready on loadCurriculum', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    const stateChanges = collectEvents(engine, 'stateChange');

    engine.loadCurriculum(mockCurriculum());

    expect(engine.state).toBe('ready');
    expect(stateChanges).toEqual([{ from: 'idle', to: 'ready' }]);
  });

  it('ready → loading on startSection', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    const stateChanges = collectEvents(engine, 'stateChange');

    engine.startSection('section-1');

    expect(engine.state).toBe('loading');
    expect(stateChanges).toEqual([{ from: 'ready', to: 'loading' }]);
  });

  it('loading → practicing on setSectionContent', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    const stateChanges = collectEvents(engine, 'stateChange');

    engine.setSectionContent(mockSectionContent());

    expect(engine.state).toBe('practicing');
    expect(stateChanges).toEqual([{ from: 'loading', to: 'practicing' }]);
  });

  it('practicing → answered on submitAnswer', () => {
    const { engine } = engineAtPracticing();
    // Skip explanation first
    engine.nextItem();
    const stateChanges = collectEvents(engine, 'stateChange');

    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });

    expect(engine.state).toBe('answered');
    expect(stateChanges).toEqual([{ from: 'practicing', to: 'answered' }]);
  });

  it('answered → practicing on nextItem', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // skip explanation
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    const stateChanges = collectEvents(engine, 'stateChange');

    engine.nextItem();

    expect(engine.state).toBe('practicing');
    expect(stateChanges).toEqual([{ from: 'answered', to: 'practicing' }]);
  });

  it('practicing → sectionComplete when all items done', () => {
    const { engine } = engineAtPracticing();
    const sectionCompleteEvents = collectEvents(engine, 'sectionComplete');

    // Walk through all items
    engine.nextItem(); // explanation → q1
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem(); // q1 → q2
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem(); // q2 → q3
    engine.submitAnswer({ type: 'ordering', order: [1, 2, 0] });
    engine.nextItem(); // q3 → q4
    engine.submitAnswer({ type: 'multi-select', selectedIndices: [0, 2] });
    engine.nextItem(); // q4 → q5
    engine.submitAnswer({
      type: 'two-stage',
      selectedIndex: 0,
      followUpSelectedIndex: 0,
    });
    engine.nextItem(); // q5 → complete

    expect(engine.state).toBe('sectionComplete');
    expect(sectionCompleteEvents).toHaveLength(1);
    expect(sectionCompleteEvents[0].section.id).toBe('section-1');
  });

  it('sectionComplete → loading on nextSection', () => {
    const { engine } = engineAtPracticing();
    // Complete section 1
    engine.nextItem();
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem();
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem();
    engine.submitAnswer({ type: 'ordering', order: [1, 2, 0] });
    engine.nextItem();
    engine.submitAnswer({ type: 'multi-select', selectedIndices: [0, 2] });
    engine.nextItem();
    engine.submitAnswer({
      type: 'two-stage',
      selectedIndex: 0,
      followUpSelectedIndex: 0,
    });
    engine.nextItem();

    expect(engine.state).toBe('sectionComplete');
    const stateChanges = collectEvents(engine, 'stateChange');
    engine.nextSection();

    // Should transition through sectionComplete → loading
    expect(engine.state).toBe('loading');
  });

  it('sectionComplete → complete when last section finishes', () => {
    const { engine } = engineAtPracticing();
    // Complete section 1
    engine.nextItem();
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem();
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem();
    engine.submitAnswer({ type: 'ordering', order: [1, 2, 0] });
    engine.nextItem();
    engine.submitAnswer({ type: 'multi-select', selectedIndices: [0, 2] });
    engine.nextItem();
    engine.submitAnswer({
      type: 'two-stage',
      selectedIndex: 0,
      followUpSelectedIndex: 0,
    });
    engine.nextItem();

    // Start and complete section 2
    engine.nextSection();
    engine.setSectionContent([
      {
        type: 'multiple-choice',
        id: 'q6',
        topicId: 'topic-3',
        question: 'What is integration testing?',
        options: ['Testing components together', 'Unit testing', 'Manual testing'],
        correctIndex: 0,
      },
    ]);
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem();
    expect(engine.state).toBe('sectionComplete');

    const courseCompleteEvents = collectEvents(engine, 'courseComplete');
    engine.nextSection();

    expect(engine.state).toBe('complete');
    expect(courseCompleteEvents).toHaveLength(1);
  });
});

// --- Invalid Transitions ---

describe('invalid transitions', () => {
  it('throws on loadCurriculum when not idle', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());

    expect(() => engine.loadCurriculum(mockCurriculum())).toThrow(InvalidTransitionError);
  });

  it('throws on startSection when idle', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    expect(() => engine.startSection('section-1')).toThrow(InvalidTransitionError);
  });

  it('throws on startSection with unknown section id', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    expect(() => engine.startSection('nonexistent')).toThrow(InvalidTransitionError);
  });

  it('throws on submitAnswer when not practicing', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    expect(() =>
      engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 })
    ).toThrow(InvalidTransitionError);
  });

  it('throws on submitAnswer when current item is an explanation', () => {
    const { engine } = engineAtPracticing();
    // Current item is an explanation
    expect(() =>
      engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 })
    ).toThrow(InvalidTransitionError);
  });

  it('throws on nextItem for unanswered question', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // skip explanation, now on q1
    // Try to skip the question without answering
    expect(() => engine.nextItem()).toThrow(InvalidTransitionError);
  });

  it('throws on setSectionContent when not loading', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    expect(() => engine.setSectionContent([])).toThrow(InvalidTransitionError);
  });

  it('throws on nextSection when not sectionComplete', () => {
    const { engine } = engineAtPracticing();
    expect(() => engine.nextSection()).toThrow(InvalidTransitionError);
  });
});

// --- Grading ---

describe('answer grading', () => {
  it('grades multiple-choice correctly', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // skip explanation
    const result = engine.submitAnswer({
      type: 'multiple-choice',
      selectedIndex: 0,
    });
    expect(result.correct).toBe(true);
    expect(result.correctAnswer).toBe('Compares values');
  });

  it('grades multiple-choice incorrectly', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem();
    const result = engine.submitAnswer({
      type: 'multiple-choice',
      selectedIndex: 2,
    });
    expect(result.correct).toBe(false);
  });

  it('grades numeric-input correctly', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // explanation
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem(); // q1 → q2
    const result = engine.submitAnswer({ type: 'numeric-input', value: 4 });
    expect(result.correct).toBe(true);
  });

  it('grades numeric-input with tolerance', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    engine.setSectionContent([
      {
        type: 'numeric-input',
        id: 'q-tol',
        topicId: 'topic-1',
        question: 'What is pi?',
        correctValue: 3.14,
        tolerance: 0.01,
      },
    ]);
    const result = engine.submitAnswer({ type: 'numeric-input', value: 3.14159 });
    // 3.14159 is within 0.01 of 3.14? |3.14159 - 3.14| = 0.00159 < 0.01
    expect(result.correct).toBe(true);
  });

  it('handles numeric-input with correctValue of 0', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    engine.setSectionContent([
      {
        type: 'numeric-input',
        id: 'q-zero',
        topicId: 'topic-1',
        question: 'What is 0?',
        correctValue: 0,
        tolerance: 0.1,
      },
    ]);
    const result = engine.submitAnswer({ type: 'numeric-input', value: 0.05 });
    expect(result.correct).toBe(true);
  });

  it('grades ordering correctly', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // explanation
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem(); // q1
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem(); // q2 → q3
    const result = engine.submitAnswer({ type: 'ordering', order: [1, 2, 0] });
    expect(result.correct).toBe(true);
    expect(result.correctAnswer).toBe('Arrange → Act → Assert');
  });

  it('grades multi-select correctly regardless of order', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem();
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem();
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem();
    engine.submitAnswer({ type: 'ordering', order: [1, 2, 0] });
    engine.nextItem(); // q3 → q4
    // Correct indices are [0, 2], submit in reverse order
    const result = engine.submitAnswer({
      type: 'multi-select',
      selectedIndices: [2, 0],
    });
    expect(result.correct).toBe(true);
  });

  it('grades two-stage correctly', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem();
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem();
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem();
    engine.submitAnswer({ type: 'ordering', order: [1, 2, 0] });
    engine.nextItem();
    engine.submitAnswer({ type: 'multi-select', selectedIndices: [0, 2] });
    engine.nextItem(); // q4 → q5
    const result = engine.submitAnswer({
      type: 'two-stage',
      selectedIndex: 0,
      followUpSelectedIndex: 0,
    });
    expect(result.correct).toBe(true);
    expect(result.correctAnswer).toBe('A fake object, then Isolation');
  });

  it('grades two-stage incorrect when follow-up is wrong', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem();
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem();
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem();
    engine.submitAnswer({ type: 'ordering', order: [1, 2, 0] });
    engine.nextItem();
    engine.submitAnswer({ type: 'multi-select', selectedIndices: [0, 2] });
    engine.nextItem();
    const result = engine.submitAnswer({
      type: 'two-stage',
      selectedIndex: 0,
      followUpSelectedIndex: 1, // wrong follow-up
    });
    expect(result.correct).toBe(false);
  });

  it('handles mismatched answer type', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // skip explanation, now on MCQ
    const result = engine.submitAnswer({ type: 'numeric-input', value: 42 });
    expect(result.correct).toBe(false);
    expect(result.explanation).toContain('type does not match');
  });
});

// --- Skip ---

describe('skipQuestion', () => {
  it('advances to the next item without answering', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // explanation → q1
    const itemEvents = collectEvents(engine, 'itemShow');

    engine.skipQuestion();

    expect(engine.state).toBe('practicing');
    expect(itemEvents).toHaveLength(1);
    expect(itemEvents[0].itemIndex).toBe(2); // q2
  });

  it('throws when current item is an explanation', () => {
    const { engine } = engineAtPracticing();
    expect(() => engine.skipQuestion()).toThrow(InvalidTransitionError);
  });
});

// --- Event Payloads ---

describe('event payloads', () => {
  it('syllabusLoaded contains the full curriculum', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    const events = collectEvents(engine, 'syllabusLoaded');

    engine.loadCurriculum(mockCurriculum());

    expect(events).toHaveLength(1);
    expect(events[0].curriculum.title).toBe('Intro to Testing');
    expect(events[0].curriculum.sections).toHaveLength(2);
  });

  it('sectionStart contains section info and position', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    const events = collectEvents(engine, 'sectionStart');

    engine.startSection('section-1');

    expect(events).toHaveLength(1);
    expect(events[0].section.id).toBe('section-1');
    expect(events[0].sectionIndex).toBe(0);
    expect(events[0].totalSections).toBe(2);
  });

  it('contentReady contains all items and section', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    const events = collectEvents(engine, 'contentReady');
    const items = mockSectionContent();

    engine.setSectionContent(items);

    expect(events).toHaveLength(1);
    expect(events[0].items).toHaveLength(items.length);
    expect(events[0].section.id).toBe('section-1');
  });

  it('itemShow contains item and position', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    const events = collectEvents(engine, 'itemShow');

    engine.setSectionContent(mockSectionContent());

    expect(events).toHaveLength(1);
    expect(events[0].item.type).toBe('explanation');
    expect(events[0].itemIndex).toBe(0);
    expect(events[0].totalItems).toBe(6);
  });

  it('answerResult contains result, studentState, and progress', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // skip explanation
    const events = collectEvents(engine, 'answerResult');

    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });

    expect(events).toHaveLength(1);
    expect(events[0].result.correct).toBe(true);
    expect(events[0].studentState.masteryByTopic).toBeDefined();
    expect(events[0].progress.currentItemIndex).toBe(1);
  });
});

// --- Student State ---

describe('mastery tracking', () => {
  it('increases mastery on correct answer', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem();
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });

    const state = engine.studentState;
    expect(state.masteryByTopic['topic-1'].score).toBeGreaterThan(0);
    expect(state.masteryByTopic['topic-1'].questionsCorrect).toBe(1);
  });

  it('decreases mastery on incorrect answer', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem();
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 3 }); // wrong

    const state = engine.studentState;
    // Started at 0, decreased — but clamped to 0
    expect(state.masteryByTopic['topic-1'].score).toBe(0);
    expect(state.masteryByTopic['topic-1'].questionsCorrect).toBe(0);
    expect(state.masteryByTopic['topic-1'].questionsAnswered).toBe(1);
  });

  it('mastery stays within 0-1 bounds', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');

    // Create 10 correct answers to push mastery high
    const items: ContentItem[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'multiple-choice' as const,
      id: `q-${i}`,
      topicId: 'topic-1',
      question: `Question ${i}`,
      options: ['A', 'B'],
      correctIndex: 0,
    }));
    engine.setSectionContent(items);

    for (let i = 0; i < 10; i++) {
      engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
      if (i < 9) engine.nextItem();
    }

    expect(engine.studentState.masteryByTopic['topic-1'].score).toBeLessThanOrEqual(1);
  });

  it('identifies gaps when mastery is below threshold', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem();
    // Wrong answer — mastery stays at 0, which is below gap threshold
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 3 });

    const state = engine.studentState;
    // All topics start at 0 mastery, so all should be gaps initially
    expect(state.gaps).toContain('topic-1');
  });

  it('returns defensive copies of student state', () => {
    const { engine } = engineAtPracticing();
    const state1 = engine.studentState;
    state1.gaps.push('fake-gap');
    const state2 = engine.studentState;
    expect(state2.gaps).not.toContain('fake-gap');
  });
});

// --- Session Progress ---

describe('session progress', () => {
  it('tracks section and item position', () => {
    const { engine } = engineAtPracticing();
    const progress = engine.sessionProgress;

    expect(progress.currentSectionIndex).toBe(0);
    expect(progress.totalSections).toBe(2);
    expect(progress.currentItemIndex).toBe(0);
    expect(progress.totalItemsInSection).toBe(6);
  });
});

// --- Async Lifecycle & Events ---

describe('async lifecycle and events', () => {
  it('emits apiCallStart and apiCallComplete events', async () => {
    let resolveExplanation: (value: any) => void = () => {};
    let resolveQuiz: (value: any) => void = () => {};

    const generator = {
      generateTopicExplanation: vi.fn(
        () => new Promise((resolve) => (resolveExplanation = resolve))
      ),
      generateTopicQuizBurst: vi.fn(
        () => new Promise((resolve) => (resolveQuiz = resolve))
      ),
    };

    const engine = new CourseEngine({ apiKey: 'test-key', generator });
    const apiEvents = collectEvents(engine, 'apiCallStart');
    const completeEvents = collectEvents(engine, 'apiCallComplete');

    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');

    // Should have started explanation for first topic
    expect(apiEvents).toHaveLength(1);
    expect(apiEvents[0].purpose).toContain('Explanation');

    // Resolve explanation
    resolveExplanation({
      type: 'explanation',
      topicId: 'topic-1',
      title: 'T1',
      content: 'C1',
    });
    await new Promise((r) => setTimeout(r, 0)); // let microtasks run

    expect(completeEvents).toHaveLength(1);
    expect(apiEvents).toHaveLength(2); // Should have started quiz
    expect(apiEvents[1].purpose).toContain('Quiz');

    // Resolve quiz
    resolveQuiz([]);
    await new Promise((r) => setTimeout(r, 0));

    expect(completeEvents).toHaveLength(2);
  });

  it('reverts to ready state and emits error on generation failure', async () => {
    let rejectExplanation: (reason: any) => void = () => {};

    const generator = {
      generateTopicExplanation: vi.fn(
        () => new Promise((_, reject) => (rejectExplanation = reject))
      ),
      generateTopicQuizBurst: vi.fn(),
    };

    const engine = new CourseEngine({ apiKey: 'test-key', generator });
    const errorEvents = collectEvents(engine, 'error');

    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    expect(engine.state).toBe('loading');

    rejectExplanation(new Error('API Failure'));
    await new Promise((r) => setTimeout(r, 0));

    expect(engine.state).toBe('ready');
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].message).toBe('API Failure');
  });

  it('reverts loading to ready state on restore', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    expect(engine.state).toBe('loading');

    const snapshot = engine.serialize();
    expect(snapshot.state).toBe('loading');

    const restored = CourseEngine.restore(snapshot, {
      apiKey: 'test-key',
      generator: mockGenerator,
    });
    expect(restored.state).toBe('ready');
  });
});

// --- Serialization ---

describe('serialize / restore', () => {
  it('round-trips engine in idle state', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    const snapshot = engine.serialize();
    const restored = CourseEngine.restore(snapshot, { apiKey: 'test-key' });
    expect(restored.state).toBe('idle');
  });

  it('round-trips engine in practicing state with full context', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // skip explanation
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem(); // advance to q2

    const snapshot = engine.serialize();
    const restored = CourseEngine.restore(snapshot, { apiKey: 'test-key' });

    expect(restored.state).toBe('practicing');
    expect(restored.curriculum?.title).toBe('Intro to Testing');
    expect(restored.currentSection?.id).toBe('section-1');
    expect(restored.currentItem?.type).toBe('numeric-input');
    expect(restored.studentState.masteryByTopic['topic-1'].questionsCorrect).toBe(1);
  });

  it('restore does not emit events', () => {
    const { engine } = engineAtPracticing();
    const snapshot = engine.serialize();

    const events: EngineEventMap['stateChange'][] = [];
    const restored = CourseEngine.restore(snapshot, { apiKey: 'test-key' });
    restored.on('stateChange', (p) => events.push(p));

    expect(events).toHaveLength(0);
  });

  it('rejects snapshots with wrong version', () => {
    const snapshot = {
      version: 999,
      state: 'idle' as const,
      curriculum: null,
      currentSectionIndex: -1,
      currentItemIndex: -1,
      sectionItems: [],
      studentState: { masteryByTopic: {}, gaps: [] },
      lastAnswerResult: null,
    };
    expect(() => CourseEngine.restore(snapshot, { apiKey: 'test-key' })).toThrow(
      'Unsupported snapshot version'
    );
  });

  it('restored engine can continue operating', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // explanation → q1

    const snapshot = engine.serialize();
    const restored = CourseEngine.restore(snapshot, { apiKey: 'test-key' });

    // Should be able to answer the current question
    const result = restored.submitAnswer({
      type: 'multiple-choice',
      selectedIndex: 0,
    });
    expect(result.correct).toBe(true);
    expect(restored.state).toBe('answered');
  });

  it('serialize returns defensive copies of snapshot data', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // explanation → q1
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem(); // q1 → q2
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem(); // q2 → q3
    engine.submitAnswer({ type: 'ordering', order: [1, 2, 0] });

    const snapshot = engine.serialize();
    snapshot.curriculum!.title = 'Mutated';
    const snapshotOrderingItem = snapshot.sectionItems[3];
    expect(snapshotOrderingItem.type).toBe('ordering');
    if (snapshotOrderingItem.type !== 'ordering') {
      throw new Error('Expected snapshot item to be ordering');
    }
    snapshotOrderingItem.items[0] = 'Mutated';
    snapshotOrderingItem.correctOrder[0] = 99;

    const snapshotAnswer = snapshot.lastAnswerResult!.userAnswer;
    expect(snapshotAnswer.type).toBe('ordering');
    if (snapshotAnswer.type !== 'ordering') {
      throw new Error('Expected snapshot answer to be ordering');
    }
    snapshotAnswer.order[0] = 99;

    expect(engine.curriculum?.title).toBe('Intro to Testing');
    const currentItem = engine.currentItem;
    expect(currentItem?.type).toBe('ordering');
    if (currentItem?.type !== 'ordering') {
      throw new Error('Expected current item to remain ordering');
    }
    expect(currentItem.items[0]).toBe('Assert');
    expect(currentItem.correctOrder[0]).toBe(1);

    const freshSnapshot = engine.serialize();
    const freshAnswer = freshSnapshot.lastAnswerResult!.userAnswer;
    expect(freshAnswer.type).toBe('ordering');
    if (freshAnswer.type !== 'ordering') {
      throw new Error('Expected fresh snapshot answer to be ordering');
    }
    expect(freshAnswer.order[0]).toBe(1);
  });

  it('restore copies caller-owned snapshot data', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // explanation → q1
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem(); // q1 → q2
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem(); // q2 → q3
    engine.submitAnswer({ type: 'ordering', order: [1, 2, 0] });
    engine.nextItem(); // q3 → q4
    engine.submitAnswer({ type: 'multi-select', selectedIndices: [0, 2] });

    const snapshot = engine.serialize();
    const restored = CourseEngine.restore(snapshot, { apiKey: 'test-key' });

    snapshot.curriculum!.title = 'Mutated';
    const snapshotMultiSelectItem = snapshot.sectionItems[4];
    expect(snapshotMultiSelectItem.type).toBe('multi-select');
    if (snapshotMultiSelectItem.type !== 'multi-select') {
      throw new Error('Expected snapshot item to be multi-select');
    }
    snapshotMultiSelectItem.options[0] = 'Mutated';
    snapshotMultiSelectItem.correctIndices[0] = 99;

    const snapshotAnswer = snapshot.lastAnswerResult!.userAnswer;
    expect(snapshotAnswer.type).toBe('multi-select');
    if (snapshotAnswer.type !== 'multi-select') {
      throw new Error('Expected snapshot answer to be multi-select');
    }
    snapshotAnswer.selectedIndices[0] = 99;

    expect(restored.curriculum?.title).toBe('Intro to Testing');
    const restoredItem = restored.currentItem;
    expect(restoredItem?.type).toBe('multi-select');
    if (restoredItem?.type !== 'multi-select') {
      throw new Error('Expected restored item to remain multi-select');
    }
    expect(restoredItem.options[0]).toBe('Vitest');
    expect(restoredItem.correctIndices[0]).toBe(0);

    const restoredSnapshot = restored.serialize();
    const restoredAnswer = restoredSnapshot.lastAnswerResult!.userAnswer;
    expect(restoredAnswer.type).toBe('multi-select');
    if (restoredAnswer.type !== 'multi-select') {
      throw new Error('Expected restored snapshot answer to be multi-select');
    }
    expect(restoredAnswer.selectedIndices[0]).toBe(0);
  });
});

// --- Defensive Copies ---

describe('defensive copies', () => {
  it('loadCurriculum stores a copy, not the original', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    const curriculum = mockCurriculum();
    engine.loadCurriculum(curriculum);

    // Mutate the original
    curriculum.title = 'Mutated';
    curriculum.sections.push({
      id: 'extra',
      title: 'Extra',
      order: 2,
      topics: [],
    });

    expect(engine.curriculum?.title).toBe('Intro to Testing');
    expect(engine.curriculum?.sections).toHaveLength(2);
  });

  it('curriculum getter returns a copy, not the internal object', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());

    const c1 = engine.curriculum!;
    c1.title = 'Mutated';
    c1.sections.push({ id: 'extra', title: 'Extra', order: 2, topics: [] });

    expect(engine.curriculum?.title).toBe('Intro to Testing');
    expect(engine.curriculum?.sections).toHaveLength(2);
  });

  it('currentSection getter returns a copy, not the internal object', () => {
    const { engine } = engineAtPracticing();

    const section = engine.currentSection!;
    section.title = 'Mutated';
    section.topics.push({ id: 'extra', title: 'Extra', description: 'Extra' });

    expect(engine.currentSection?.title).toBe('Unit Testing');
    expect(engine.currentSection?.topics).toHaveLength(2);
  });

  it('currentItem getter returns a copy, not the internal object', () => {
    const { engine } = engineAtPracticing();

    const item = engine.currentItem!;
    (item as Record<string, unknown>).title = 'Mutated';

    expect((engine.currentItem as Record<string, unknown>).title).toBe(
      'Understanding Assertions'
    );
  });

  it('currentItem getter deep-copies nested question arrays', () => {
    const { engine } = engineAtPracticing();
    engine.nextItem(); // move from explanation to multiple-choice question

    const item = engine.currentItem;
    expect(item?.type).toBe('multiple-choice');
    if (item?.type !== 'multiple-choice') {
      throw new Error('Expected current item to be multiple-choice');
    }

    item.options[0] = 'Mutated';

    const freshItem = engine.currentItem;
    expect(freshItem?.type).toBe('multiple-choice');
    if (freshItem?.type !== 'multiple-choice') {
      throw new Error('Expected current item to remain multiple-choice');
    }

    expect(freshItem.options[0]).toBe('Compares values');
  });

  it('setSectionContent stores deep copies of all question array fields', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    const items = mockSectionContent();

    engine.setSectionContent(items);

    const multipleChoice = items[1];
    const ordering = items[3];
    const multiSelect = items[4];
    const twoStage = items[5];

    if (multipleChoice.type !== 'multiple-choice') {
      throw new Error('Expected test item to be multiple-choice');
    }
    if (ordering.type !== 'ordering') {
      throw new Error('Expected test item to be ordering');
    }
    if (multiSelect.type !== 'multi-select') {
      throw new Error('Expected test item to be multi-select');
    }
    if (twoStage.type !== 'two-stage') {
      throw new Error('Expected test item to be two-stage');
    }

    multipleChoice.options[0] = 'Mutated';
    ordering.items[0] = 'Mutated';
    ordering.correctOrder[0] = 99;
    multiSelect.options[0] = 'Mutated';
    multiSelect.correctIndices[0] = 99;
    twoStage.options[0] = 'Mutated';
    twoStage.followUpOptions[0] = 'Mutated';

    engine.nextItem();
    const storedMultipleChoice = engine.currentItem;
    expect(storedMultipleChoice?.type).toBe('multiple-choice');
    if (storedMultipleChoice?.type !== 'multiple-choice') {
      throw new Error('Expected stored item to be multiple-choice');
    }
    expect(storedMultipleChoice.options[0]).toBe('Compares values');

    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 });
    engine.nextItem();
    engine.submitAnswer({ type: 'numeric-input', value: 4 });
    engine.nextItem();

    const storedOrdering = engine.currentItem;
    expect(storedOrdering?.type).toBe('ordering');
    if (storedOrdering?.type !== 'ordering') {
      throw new Error('Expected stored item to be ordering');
    }
    expect(storedOrdering.items[0]).toBe('Assert');
    expect(storedOrdering.correctOrder[0]).toBe(1);

    engine.skipQuestion();
    const storedMultiSelect = engine.currentItem;
    expect(storedMultiSelect?.type).toBe('multi-select');
    if (storedMultiSelect?.type !== 'multi-select') {
      throw new Error('Expected stored item to be multi-select');
    }
    expect(storedMultiSelect.options[0]).toBe('Vitest');
    expect(storedMultiSelect.correctIndices[0]).toBe(0);

    engine.skipQuestion();
    const storedTwoStage = engine.currentItem;
    expect(storedTwoStage?.type).toBe('two-stage');
    if (storedTwoStage?.type !== 'two-stage') {
      throw new Error('Expected stored item to be two-stage');
    }
    expect(storedTwoStage.options[0]).toBe('A fake object');
    expect(storedTwoStage.followUpOptions[0]).toBe('Isolation');
  });

  it('contentReady emits deep copies of generated content', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    const contentReadyEvents = collectEvents(engine, 'contentReady');
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    engine.setSectionContent(mockSectionContent());

    const emittedItem = contentReadyEvents[0].items[1];
    expect(emittedItem.type).toBe('multiple-choice');
    if (emittedItem.type !== 'multiple-choice') {
      throw new Error('Expected emitted item to be multiple-choice');
    }

    emittedItem.options[0] = 'Mutated';

    engine.nextItem();
    const internalItem = engine.currentItem;
    expect(internalItem?.type).toBe('multiple-choice');
    if (internalItem?.type !== 'multiple-choice') {
      throw new Error('Expected current item to be multiple-choice');
    }
    expect(internalItem.options[0]).toBe('Compares values');
  });
});
