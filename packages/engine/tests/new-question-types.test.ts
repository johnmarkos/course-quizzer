import { describe, it, expect } from 'vitest';
import { CourseEngine } from '../src/index.js';
import type { CurriculumPlan, ContentItem } from '../src/index.js';

function mockCurriculum(): CurriculumPlan {
  return {
    title: 'Practical Skills',
    description: 'A course about practical skills',
    sections: [
      {
        id: 'section-1',
        title: 'Guitar Basics',
        order: 0,
        topics: [
          { id: 'topic-1', title: 'Setup', description: 'Setting up your guitar' },
        ],
      },
    ],
  };
}

const mockGenerator = {
  generateTopicExplanation: () => new Promise(() => {}),
  generateTopicQuizBurst: () => new Promise(() => {}),
};

describe('New Question Types', () => {
  it('grades checklist correctly', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    
    const checklistItem: ContentItem = {
      type: 'checklist',
      id: 'q-checklist',
      topicId: 'topic-1',
      question: 'Perform the following steps:',
      items: ['Plug in guitar', 'Turn on amp', 'Tune strings'],
    };
    
    engine.setSectionContent([checklistItem]);
    
    // Correct: all items checked
    const resultCorrect = engine.submitAnswer({
      type: 'checklist',
      checkedIndices: [0, 1, 2],
    });
    expect(resultCorrect.correct).toBe(true);
    
    // Incorrect: not all items checked
    const engine2 = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine2.loadCurriculum(mockCurriculum());
    engine2.startSection('section-1');
    engine2.setSectionContent([checklistItem]);

    const resultIncorrect = engine2.submitAnswer({
      type: 'checklist',
      checkedIndices: [0, 1],
    });
    expect(resultIncorrect.correct).toBe(false);
  });

  it('grades code correctly with expectedPattern', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    
    const codeItem: ContentItem = {
      type: 'code',
      id: 'q-code',
      topicId: 'topic-1',
      question: 'Write a function that returns true.',
      language: 'javascript',
      expectedPattern: 'return true',
    };
    
    engine.setSectionContent([codeItem]);
    
    // Correct: matches pattern
    const resultCorrect = engine.submitAnswer({
      type: 'code',
      code: 'function test() { return true; }',
    });
    expect(resultCorrect.correct).toBe(true);
    
    // Incorrect: does not match pattern
    const engine2 = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine2.loadCurriculum(mockCurriculum());
    engine2.startSection('section-1');
    engine2.setSectionContent([codeItem]);

    const resultIncorrect = engine2.submitAnswer({
      type: 'code',
      code: 'function test() { return false; }',
    });
    expect(resultIncorrect.correct).toBe(false);
  });

  it('grades code correctly without expectedPattern (always true)', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    
    const codeItem: ContentItem = {
      type: 'code',
      id: 'q-code-no-pattern',
      topicId: 'topic-1',
      question: 'Write some code.',
      language: 'javascript',
    };
    
    engine.setSectionContent([codeItem]);
    
    const result = engine.submitAnswer({
      type: 'code',
      code: 'any code',
    });
    expect(result.correct).toBe(true);
  });

  it('grades self-evaluation correctly (always true)', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    
    const selfEvalItem: ContentItem = {
      type: 'self-evaluation',
      id: 'q-self-eval',
      topicId: 'topic-1',
      question: 'How do you feel about your progress?',
      options: ['Need more practice', 'Got it'],
    };
    
    engine.setSectionContent([selfEvalItem]);
    
    const result = engine.submitAnswer({
      type: 'self-evaluation',
      selectedIndex: 0,
    });
    expect(result.correct).toBe(true);
  });

  it('round-trips new question types via serialization', () => {
    const engine = new CourseEngine({ apiKey: 'test-key', generator: mockGenerator });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    
    const items: ContentItem[] = [
      {
        type: 'checklist',
        id: 'q1',
        topicId: 'topic-1',
        question: 'Check',
        items: ['A', 'B'],
      },
      {
        type: 'code',
        id: 'q2',
        topicId: 'topic-1',
        question: 'Code',
        language: 'ts',
      },
      {
        type: 'self-evaluation',
        id: 'q3',
        topicId: 'topic-1',
        question: 'Eval',
        options: ['1', '2'],
      }
    ];
    
    engine.setSectionContent(items);
    
    const snapshot = engine.serialize();
    const restored = CourseEngine.restore(snapshot, { apiKey: 'test-key' });
    
    expect(restored.currentItem?.type).toBe('checklist');
    restored.submitAnswer({ type: 'checklist', checkedIndices: [0, 1] });
    restored.nextItem();
    expect(restored.currentItem?.type).toBe('code');
    restored.submitAnswer({ type: 'code', code: 'test' });
    restored.nextItem();
    expect(restored.currentItem?.type).toBe('self-evaluation');
  });
});
