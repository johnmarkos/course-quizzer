// --- Code Evaluation Prompt ---
// Grades a student-submitted code answer with the AI tutor.
// The engine never executes student code; this is text-in, text-out feedback.

import type { CodeQuestion } from '../content/types.js';
import type { PromptMessages } from './types.js';

export const CODE_EVALUATION_VERSION = '1.0';

// --- Tool Schema ---

const CODE_EVALUATION_TOOL = {
  name: 'evaluate_code_submission',
  description:
    'Evaluate a student code submission against a programming question. ' +
    'Return a correctness verdict and concise tutor feedback.',
  inputSchema: {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        enum: ['correct', 'partial', 'incorrect'],
        description:
          'correct if the submission satisfies the prompt, partial if the core idea is present but incomplete, incorrect otherwise.',
      },
      feedback: {
        type: 'string',
        description:
          'One to three short sentences explaining the verdict and the next improvement.',
      },
    },
    required: ['verdict', 'feedback'],
  },
};

// --- Prompt Builders ---

function requireNonEmptyString(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Code evaluation ${fieldName} is required`);
  }
}

function buildSystemPrompt(): string {
  return `You are an expert programming tutor evaluating a student's code answer.

Guidelines:
- Do not execute code, simulate execution, call tools, or claim that tests were run
- Evaluate only from the question, language, starter code, and student submission
- Mark "correct" only when the submission satisfies the requested behavior
- Mark "partial" when the main approach is present but incomplete or slightly wrong
- Mark "incorrect" when the submission solves a different task or misses the core requirement
- Give brief tutor-style feedback that helps the student improve
- Do not include hidden tests, executable code, or security-sensitive advice`;
}

function buildUserPrompt(question: CodeQuestion, studentAnswer: string): string {
  const starterCode = question.initialCode ?? '(none)';

  return `Evaluate this code submission.

<question>
Language: ${question.language}
Prompt: ${question.question}
Starter code:
${starterCode}
</question>

<student_submission>
${studentAnswer}
</student_submission>`;
}

// --- Public API ---

export function buildCodeEvaluationPrompt(params: {
  question: CodeQuestion;
  studentAnswer: string;
}): PromptMessages {
  requireNonEmptyString(params.question.id, 'question id');
  requireNonEmptyString(params.question.topicId, 'topic id');
  requireNonEmptyString(params.question.question, 'question');
  requireNonEmptyString(params.question.language, 'language');

  return {
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(params.question, params.studentAnswer),
      },
    ],
    tools: [CODE_EVALUATION_TOOL],
    toolChoice: { type: 'tool', name: 'evaluate_code_submission' },
  };
}
