import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { CodeEvaluator } from '../src/content/CodeEvaluator.js';
import { CourseEngine, EngineError } from '../src/index.js';
import {
  buildCodeEvaluationPrompt,
  CODE_EVALUATION_VERSION,
} from '../src/prompts/code-evaluation.js';
import type {
  CodeEvaluation,
  CodeEvaluationClient,
  CodeQuestion,
} from '../src/content/types.js';
import type { CurriculumPlan } from '../src/index.js';
import type { ProviderClient, ProviderResponse } from '../src/provider/types.js';

type RecordedCodeEvaluationCase = {
  label: string;
  question: CodeQuestion;
  studentAnswer: string;
  expectedVerdict: CodeEvaluation['verdict'];
  response: ProviderResponse;
};

function loadRecordedCase(fileName: string): RecordedCodeEvaluationCase {
  const fixtureUrl = new URL(`./fixtures/recorded/${fileName}`, import.meta.url);
  return JSON.parse(
    readFileSync(fileURLToPath(fixtureUrl), 'utf8')
  ) as RecordedCodeEvaluationCase;
}

function mockProvider(...responses: ProviderResponse[]): ProviderClient {
  const sendMessage = vi.fn();
  for (const response of responses) {
    sendMessage.mockResolvedValueOnce(response);
  }
  return { sendMessage };
}

function textOnlyResponse(): ProviderResponse {
  return {
    id: 'msg_text_only',
    content: [{ type: 'text', text: 'I think this is correct.' }],
    model: 'claude-sonnet-4-20250514',
    stopReason: 'end_turn',
    usage: { inputTokens: 10, outputTokens: 8 },
  };
}

function mockCurriculum(): CurriculumPlan {
  return {
    title: 'Programming Practice',
    description: 'A course about practical programming exercises.',
    sections: [
      {
        id: 'section-1',
        title: 'Code Practice',
        order: 0,
        topics: [
          {
            id: 'array-filtering',
            title: 'Array Filtering',
            description: 'Filtering array values with a predicate.',
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

const codeQuestion: CodeQuestion = {
  type: 'code',
  id: 'q-code',
  topicId: 'array-filtering',
  question: 'Write a JavaScript function that keeps scores greater than 70.',
  language: 'javascript',
  initialCode: 'function passingScores(scores) {\n  return [];\n}',
};

function engineWithCodeQuestion(codeEvaluator: CodeEvaluationClient): CourseEngine {
  const engine = new CourseEngine({
    apiKey: 'test-key',
    generator: mockGenerator,
    codeEvaluator,
  });
  engine.loadCurriculum(mockCurriculum());
  engine.startSection('section-1');
  engine.setSectionContent([codeQuestion]);
  return engine;
}

describe('code evaluation prompt', () => {
  it('exports a versioned tool-use prompt with untrusted input in the user message', () => {
    const prompt = buildCodeEvaluationPrompt({
      question: codeQuestion,
      studentAnswer: '<img src=x onerror=alert(1)>',
    });

    expect(CODE_EVALUATION_VERSION).toBe('1.0');
    expect(prompt.system).toContain('Do not execute');
    expect(prompt.system).not.toContain(codeQuestion.question);
    expect(prompt.messages[0].content).toContain(codeQuestion.question);
    expect(prompt.messages[0].content).toContain('<img src=x onerror=alert(1)>');
    expect(prompt.tools?.[0].name).toBe('evaluate_code_submission');
    expect(prompt.toolChoice).toEqual({
      type: 'tool',
      name: 'evaluate_code_submission',
    });
  });

  it('rejects malformed prompt inputs before sending them to the provider', () => {
    expect(() =>
      buildCodeEvaluationPrompt({
        question: { ...codeQuestion, question: ' ' },
        studentAnswer: '',
      })
    ).toThrow(/question/);
  });
});

describe('CodeEvaluator', () => {
  const recordedCases = [
    loadRecordedCase('code-evaluation-correct.json'),
    loadRecordedCase('code-evaluation-partial.json'),
    loadRecordedCase('code-evaluation-incorrect.json'),
  ];

  it.each(recordedCases)(
    'parses recorded Claude response for $label',
    async (fixture) => {
      const evaluator = new CodeEvaluator(mockProvider(fixture.response));

      const result = await evaluator.evaluateCode(
        fixture.question,
        fixture.studentAnswer
      );

      expect(result.verdict).toBe(fixture.expectedVerdict);
      expect(result.correct).toBe(fixture.expectedVerdict === 'correct');
      expect(result.feedback.length).toBeGreaterThan(20);
    }
  );

  it('retries once when Claude does not return the evaluation tool call', async () => {
    const fixture = recordedCases[0];
    const provider = mockProvider(textOnlyResponse(), fixture.response);
    const evaluator = new CodeEvaluator(provider);

    const result = await evaluator.evaluateCode(fixture.question, fixture.studentAnswer);

    expect(result.verdict).toBe('correct');
    expect(provider.sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe('CourseEngine code answer evaluation', () => {
  it('rejects sync code submissions so callers cannot bypass tutor grading', () => {
    const codeEvaluator: CodeEvaluationClient = {
      evaluateCode: vi.fn().mockResolvedValue({
        verdict: 'correct',
        correct: true,
        feedback: 'The solution is correct.',
      }),
    };
    const engine = engineWithCodeQuestion(codeEvaluator);

    expect(() =>
      engine.submitAnswer({
        type: 'code',
        code: 'function passingScores(scores) { return scores; }',
      })
    ).toThrow(EngineError);
    expect(codeEvaluator.evaluateCode).not.toHaveBeenCalled();
    expect(engine.state).toBe('practicing');
  });

  it('routes code submissions through the async evaluator and emits tutor feedback', async () => {
    const codeEvaluator: CodeEvaluationClient = {
      evaluateCode: vi.fn().mockResolvedValue({
        verdict: 'partial',
        correct: false,
        feedback: 'The predicate is close, but the function returns booleans.',
      }),
    };
    const engine = engineWithCodeQuestion(codeEvaluator);
    const answerResults: unknown[] = [];
    const apiEvents: string[] = [];

    engine.on('answerResult', (payload) => answerResults.push(payload.result));
    engine.on('apiCallStart', (payload) => apiEvents.push(`start:${payload.purpose}`));
    engine.on('apiCallComplete', (payload) =>
      apiEvents.push(`complete:${payload.purpose}`)
    );

    const result = await engine.submitAnswerAsync({
      type: 'code',
      code: 'function passingScores(scores) { return scores.map(s => s >= 70); }',
    });

    expect(codeEvaluator.evaluateCode).toHaveBeenCalledWith(
      codeQuestion,
      'function passingScores(scores) { return scores.map(s => s >= 70); }'
    );
    expect(result.correct).toBe(false);
    expect(result.evaluation).toEqual({
      verdict: 'partial',
      feedback: 'The predicate is close, but the function returns booleans.',
    });
    expect(result.explanation).toBe(
      'The predicate is close, but the function returns booleans.'
    );
    expect(engine.state).toBe('answered');
    expect(answerResults).toHaveLength(1);
    expect(apiEvents).toEqual([
      'start:Code evaluation for q-code',
      'complete:Code evaluation for q-code',
    ]);
  });

  it('falls back to the self-evaluation path when AI grading fails', async () => {
    const nextCodeQuestion: CodeQuestion = {
      ...codeQuestion,
      id: 'q-code-next',
    };
    const codeEvaluator: CodeEvaluationClient = {
      evaluateCode: vi
        .fn()
        .mockRejectedValueOnce(new Error('provider unavailable'))
        .mockResolvedValueOnce({
          verdict: 'correct',
          correct: true,
          feedback: 'The next submission is correct.',
        }),
    };
    const engine = new CourseEngine({
      apiKey: 'test-key',
      generator: mockGenerator,
      codeEvaluator,
    });
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    engine.setSectionContent([codeQuestion, nextCodeQuestion]);

    const result = await engine.submitAnswerAsync({
      type: 'code',
      code: 'function passingScores(scores) { return scores; }',
    });

    expect(result.correct).toBe(true);
    expect(result.correctAnswer).toBe('Self-assessment submitted');
    expect(result.explanation).toBe(
      'Tutor feedback is unavailable, so this code answer was marked complete for self-assessment.'
    );
    expect(engine.state).toBe('answered');

    engine.nextItem();
    const nextResult = await engine.submitAnswerAsync({
      type: 'code',
      code: 'function passingScores(scores) { return scores.filter(s => s > 70); }',
    });

    expect(nextResult.correct).toBe(true);
    expect(nextResult.evaluation?.feedback).toBe('The next submission is correct.');
    expect(codeEvaluator.evaluateCode).toHaveBeenCalledTimes(2);
  });

  it('rejects concurrent code submissions while tutor grading is in flight', async () => {
    let resolveEvaluation!: (evaluation: CodeEvaluation) => void;
    const pendingEvaluation = new Promise<CodeEvaluation>((resolve) => {
      resolveEvaluation = resolve;
    });
    const codeEvaluator: CodeEvaluationClient = {
      evaluateCode: vi.fn().mockReturnValue(pendingEvaluation),
    };
    const engine = engineWithCodeQuestion(codeEvaluator);

    const firstSubmission = engine.submitAnswerAsync({
      type: 'code',
      code: 'function passingScores(scores) { return scores; }',
    });
    const secondSubmission = engine.submitAnswerAsync({
      type: 'code',
      code: 'function passingScores(scores) { return scores.filter(Boolean); }',
    });

    await expect(secondSubmission).rejects.toThrow(EngineError);
    expect(codeEvaluator.evaluateCode).toHaveBeenCalledTimes(1);
    expect(engine.state).toBe('practicing');

    resolveEvaluation({
      verdict: 'correct',
      correct: true,
      feedback: 'The submission filters the scores correctly.',
    });

    const result = await firstSubmission;
    expect(result.correct).toBe(true);
    expect(engine.state).toBe('answered');
    expect(codeEvaluator.evaluateCode).toHaveBeenCalledTimes(1);
  });

  it('rejects public mutations while tutor grading is in flight', async () => {
    let resolveEvaluation!: (evaluation: CodeEvaluation) => void;
    const pendingEvaluation = new Promise<CodeEvaluation>((resolve) => {
      resolveEvaluation = resolve;
    });
    const codeEvaluator: CodeEvaluationClient = {
      evaluateCode: vi.fn().mockReturnValue(pendingEvaluation),
    };
    const nextCodeQuestion: CodeQuestion = {
      ...codeQuestion,
      id: 'q-code-next',
    };
    const engine = new CourseEngine({
      apiKey: 'test-key',
      generator: mockGenerator,
      codeEvaluator,
    });
    const answerResults: unknown[] = [];
    engine.on('answerResult', (payload) => answerResults.push(payload.result));
    engine.loadCurriculum(mockCurriculum());
    engine.startSection('section-1');
    engine.setSectionContent([codeQuestion, nextCodeQuestion]);

    const firstSubmission = engine.submitAnswerAsync({
      type: 'code',
      code: 'function passingScores(scores) { return scores; }',
    });

    await expect(
      engine.submitAnswerAsync({ type: 'multiple-choice', selectedIndex: 0 })
    ).rejects.toThrow(EngineError);
    expect(() => engine.skipQuestion()).toThrow(EngineError);
    expect(engine.currentItem?.id).toBe('q-code');
    expect(engine.state).toBe('practicing');
    expect(answerResults).toHaveLength(0);
    expect(codeEvaluator.evaluateCode).toHaveBeenCalledTimes(1);

    resolveEvaluation({
      verdict: 'correct',
      correct: true,
      feedback: 'The submission filters the scores correctly.',
    });

    const result = await firstSubmission;
    expect(result.correct).toBe(true);
    expect(engine.currentItem?.id).toBe('q-code');
    expect(engine.state).toBe('answered');
    expect(answerResults).toHaveLength(1);
    expect(codeEvaluator.evaluateCode).toHaveBeenCalledTimes(1);
  });
});
