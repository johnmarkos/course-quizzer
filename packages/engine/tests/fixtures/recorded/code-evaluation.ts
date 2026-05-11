// --- Recorded Fixture: Code Evaluation v1.0 ---
// Captured-format Claude responses for AI tutor grading of code answers.

import type { CodeEvaluationVerdict } from '../../../src/content/CodeEvaluator.js';
import type { CodeQuestion } from '../../../src/content/types.js';
import type { ProviderResponse } from '../../../src/provider/types.js';

export type RecordedCodeEvaluationCase = {
  label: string;
  question: CodeQuestion;
  studentCode: string;
  expectedVerdict: CodeEvaluationVerdict;
  expectedFeedback: string;
  response: ProviderResponse;
};

function codeEvaluationResponse(
  id: string,
  verdict: CodeEvaluationVerdict,
  feedback: string
): ProviderResponse {
  return {
    id: `msg_code_eval_${id}`,
    content: [
      {
        type: 'tool_use',
        id: `toolu_code_eval_${id}`,
        name: 'evaluate_code_answer',
        input: { verdict, feedback },
      },
    ],
    model: 'claude-sonnet-4-20250514',
    stopReason: 'tool_use',
    usage: { inputTokens: 640, outputTokens: 120 },
  };
}

export const RECORDED_CODE_EVALUATION_CASES: RecordedCodeEvaluationCase[] = [
  {
    label: 'correct TypeScript array helper',
    question: {
      type: 'code',
      id: 'code-arrays-1',
      topicId: 'arrays',
      question:
        'Write a TypeScript function firstItem that returns the first item in an array, or undefined for an empty array.',
      language: 'TypeScript',
    },
    studentCode:
      'function firstItem<T>(items: T[]): T | undefined {\n  return items[0];\n}',
    expectedVerdict: 'correct',
    expectedFeedback:
      'This satisfies the prompt: indexing at 0 returns the first item and naturally returns undefined for an empty array.',
    response: codeEvaluationResponse(
      'arrays_correct',
      'correct',
      'This satisfies the prompt: indexing at 0 returns the first item and naturally returns undefined for an empty array.'
    ),
  },
  {
    label: 'partial Python validation helper',
    question: {
      type: 'code',
      id: 'code-validation-1',
      topicId: 'validation',
      question:
        'Write a Python function is_positive_even that returns True only when n is both positive and even.',
      language: 'Python',
    },
    studentCode: 'def is_positive_even(n):\n    return n % 2 == 0',
    expectedVerdict: 'partial',
    expectedFeedback:
      'The even-number check is present, but the answer does not reject zero or negative even numbers.',
    response: codeEvaluationResponse(
      'validation_partial',
      'partial',
      'The even-number check is present, but the answer does not reject zero or negative even numbers.'
    ),
  },
  {
    label: 'incorrect JavaScript reduce implementation',
    question: {
      type: 'code',
      id: 'code-reduce-1',
      topicId: 'reducers',
      question:
        'Write a JavaScript function sum that returns the sum of every number in an array.',
      language: 'JavaScript',
      initialCode: 'function sum(numbers) {\n  // your code here\n}',
    },
    studentCode: 'function sum(numbers) {\n  return numbers.length;\n}',
    expectedVerdict: 'incorrect',
    expectedFeedback:
      'This returns the number of elements, not the sum of their values. Accumulate the values instead.',
    response: codeEvaluationResponse(
      'reduce_incorrect',
      'incorrect',
      'This returns the number of elements, not the sum of their values. Accumulate the values instead.'
    ),
  },
];
