import { describe, expect, it, vi } from 'vitest';
import {
  buildCodeEvaluationPrompt,
  CODE_EVALUATION_VERSION,
} from '../src/prompts/code-evaluation.js';
import { CodeEvaluator } from '../src/content/CodeEvaluator.js';
import type { ProviderClient, ProviderResponse } from '../src/provider/types.js';
import {
  RECORDED_CODE_EVALUATION_CASES,
  type RecordedCodeEvaluationCase,
} from './fixtures/recorded/code-evaluation.js';

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
    content: [{ type: 'text', text: 'I cannot evaluate that.' }],
    model: 'claude-sonnet-4-20250514',
    stopReason: 'end_turn',
    usage: { inputTokens: 100, outputTokens: 20 },
  };
}

describe('code evaluation prompt', () => {
  const recordedCase = RECORDED_CODE_EVALUATION_CASES[0];

  it('exports version constant', () => {
    expect(CODE_EVALUATION_VERSION).toBe('1.0');
  });

  it('builds a tool-backed grading prompt', () => {
    const prompt = buildCodeEvaluationPrompt({
      question: recordedCase.question,
      studentCode: recordedCase.studentCode,
    });

    expect(prompt.system).toContain('AI tutor');
    expect(prompt.system).toContain('Do not execute');
    expect(prompt.messages[0].content).toContain(recordedCase.question.question);
    expect(prompt.messages[0].content).toContain(recordedCase.studentCode);
    expect(prompt.tools![0].name).toBe('evaluate_code_answer');
    expect(prompt.toolChoice).toEqual({
      type: 'tool',
      name: 'evaluate_code_answer',
    });
  });

  it('keeps student-controlled prompt data out of the system prompt', () => {
    const prompt = buildCodeEvaluationPrompt({
      question: {
        ...recordedCase.question,
        question: 'SECRET_QUESTION',
        language: 'SECRET_LANGUAGE',
      },
      studentCode: 'SECRET_CODE',
    });

    expect(prompt.messages[0].content).toContain('SECRET_QUESTION');
    expect(prompt.messages[0].content).toContain('SECRET_LANGUAGE');
    expect(prompt.messages[0].content).toContain('SECRET_CODE');
    expect(prompt.system).not.toContain('SECRET_QUESTION');
    expect(prompt.system).not.toContain('SECRET_LANGUAGE');
    expect(prompt.system).not.toContain('SECRET_CODE');
  });
});

describe('CodeEvaluator', () => {
  it.each(RECORDED_CODE_EVALUATION_CASES)(
    'parses recorded Claude response: $label',
    async (recordedCase: RecordedCodeEvaluationCase) => {
      const evaluator = new CodeEvaluator(mockProvider(recordedCase.response));

      const result = await evaluator.evaluateCodeAnswer(
        recordedCase.question,
        recordedCase.studentCode
      );

      expect(result).toEqual({
        verdict: recordedCase.expectedVerdict,
        feedback: recordedCase.expectedFeedback,
      });
    }
  );

  it('retries once when the first response is missing the tool payload', async () => {
    const recordedCase = RECORDED_CODE_EVALUATION_CASES[0];
    const provider = mockProvider(textOnlyResponse(), recordedCase.response);
    const evaluator = new CodeEvaluator(provider);

    const result = await evaluator.evaluateCodeAnswer(
      recordedCase.question,
      recordedCase.studentCode
    );

    expect(result.verdict).toBe('correct');
    expect(provider.sendMessage).toHaveBeenCalledTimes(2);
  });
});
