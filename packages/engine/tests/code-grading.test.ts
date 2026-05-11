import { describe, expect, it, vi } from 'vitest';
import { CourseEngine } from '../src/index.js';
import type {
  CodeAnswerEvaluator,
  CodeEvaluation,
} from '../src/content/CodeEvaluator.js';
import type {
  CodeQuestion,
  ContentItem,
  CurriculumPlan,
  EngineEventMap,
} from '../src/index.js';

function mockCurriculum(): CurriculumPlan {
  return {
    title: 'Programming Basics',
    description: 'A course about programming tasks.',
    sections: [
      {
        id: 'section-1',
        title: 'Functions',
        order: 0,
        topics: [
          {
            id: 'topic-1',
            title: 'Return Values',
            description: 'Writing functions that return values.',
          },
        ],
      },
    ],
  };
}

const mockGenerator = {
  generateTopicExplanation: () => new Promise<never>(() => {}),
  generateTopicQuizBurst: () => new Promise<never>(() => {}),
};

function codeQuestion(): CodeQuestion {
  return {
    type: 'code',
    id: 'q-code',
    topicId: 'topic-1',
    question: 'Write a function that returns true.',
    language: 'TypeScript',
    initialCode: 'function answer(): boolean {\n}',
  };
}

function engineWithCodeQuestion(evaluator: CodeAnswerEvaluator): CourseEngine {
  const engine = new CourseEngine({
    apiKey: 'test-key',
    generator: mockGenerator,
    codeEvaluator: evaluator,
  });
  engine.loadCurriculum(mockCurriculum());
  engine.startSection('section-1');
  engine.setSectionContent([codeQuestion() as ContentItem]);
  return engine;
}

function evaluatorReturning(evaluation: CodeEvaluation): CodeAnswerEvaluator {
  return {
    evaluateCodeAnswer: vi.fn(async () => evaluation),
  };
}

describe('AI tutor code grading', () => {
  it('uses the code evaluator verdict and feedback for code answers', async () => {
    const evaluator = evaluatorReturning({
      verdict: 'partial',
      feedback: 'You returned a boolean, but it is false instead of true.',
    });
    const engine = engineWithCodeQuestion(evaluator);
    const answerResultEvents: EngineEventMap['answerResult'][] = [];
    const stateChanges: EngineEventMap['stateChange'][] = [];
    engine.on('answerResult', (payload) => answerResultEvents.push(payload));
    engine.on('stateChange', (payload) => stateChanges.push(payload));

    const result = await engine.submitCodeAnswer({
      type: 'code',
      code: 'function answer(): boolean {\n  return false;\n}',
    });

    expect(evaluator.evaluateCodeAnswer).toHaveBeenCalledWith(
      codeQuestion(),
      'function answer(): boolean {\n  return false;\n}'
    );
    expect(result.correct).toBe(false);
    expect(result.codeEvaluation).toEqual({
      verdict: 'partial',
      feedback: 'You returned a boolean, but it is false instead of true.',
    });
    expect(result.explanation).toBe(
      'You returned a boolean, but it is false instead of true.'
    );
    expect(engine.studentState.masteryByTopic['topic-1'].questionsAnswered).toBe(1);
    expect(engine.studentState.masteryByTopic['topic-1'].questionsCorrect).toBe(0);
    expect(answerResultEvents).toHaveLength(1);
    expect(stateChanges).toEqual([
      { from: 'practicing', to: 'grading' },
      { from: 'grading', to: 'answered' },
    ]);
  });

  it('marks correct code evaluations as correct for mastery', async () => {
    const engine = engineWithCodeQuestion(
      evaluatorReturning({
        verdict: 'correct',
        feedback: 'This returns true as requested.',
      })
    );

    const result = await engine.submitCodeAnswer({
      type: 'code',
      code: 'function answer(): boolean {\n  return true;\n}',
    });

    expect(result.correct).toBe(true);
    expect(engine.studentState.masteryByTopic['topic-1'].questionsCorrect).toBe(1);
  });

  it('falls back to self-evaluation when code evaluation fails', async () => {
    const evaluator: CodeAnswerEvaluator = {
      evaluateCodeAnswer: vi.fn(async () => {
        throw new Error('provider failed');
      }),
    };
    const engine = engineWithCodeQuestion(evaluator);

    const result = await engine.submitCodeAnswer({
      type: 'code',
      code: 'function answer(): boolean {\n  return false;\n}',
    });

    expect(result.correct).toBe(true);
    expect(result.correctAnswer).toBe('Self-assessment submitted');
    expect(result.codeEvaluation).toEqual({
      verdict: 'correct',
      feedback:
        'The AI tutor could not evaluate this code, so CourseQuizzer recorded the submission as completed without executing it.',
    });
    expect(engine.studentState.masteryByTopic['topic-1'].questionsCorrect).toBe(1);
  });

  it('emits API loading events around tutor grading', async () => {
    const engine = engineWithCodeQuestion(
      evaluatorReturning({
        verdict: 'correct',
        feedback: 'This returns true.',
      })
    );
    const starts: EngineEventMap['apiCallStart'][] = [];
    const completes: EngineEventMap['apiCallComplete'][] = [];
    engine.on('apiCallStart', (payload) => starts.push(payload));
    engine.on('apiCallComplete', (payload) => completes.push(payload));

    await engine.submitCodeAnswer({
      type: 'code',
      code: 'function answer(): boolean {\n  return true;\n}',
    });

    expect(starts).toEqual([
      { id: 'code-evaluation-1', purpose: 'Code evaluation: q-code' },
    ]);
    expect(completes).toEqual(starts);
  });
});
