// --- Code Evaluation Prompt ---
// Evaluates a student-submitted code answer by reading it as text.
// The engine never executes student code.

import type { CodeQuestion } from '../content/types.js';
import type { PromptMessages } from './types.js';

export const CODE_EVALUATION_VERSION = '1.0';

// --- Tool Schema ---

function buildCodeEvaluationTool() {
  return {
    name: 'evaluate_code_answer',
    description:
      'Evaluate a student code submission against the requested task without executing it.',
    inputSchema: {
      type: 'object',
      properties: {
        verdict: {
          type: 'string',
          enum: ['correct', 'partial', 'incorrect'],
          description:
            'correct if the submission satisfies the prompt, partial if it is meaningfully close but incomplete, incorrect otherwise',
        },
        feedback: {
          type: 'string',
          description:
            'Short tutor-style feedback explaining the verdict and the most important next step',
        },
      },
      required: ['verdict', 'feedback'],
    },
  };
}

// --- Prompt Builders ---

function buildSystemPrompt(): string {
  return `You are an AI tutor evaluating a student's code answer.

Do not execute, simulate execution of, or request execution of the code. Read the code as text and judge whether it satisfies the task.

Return:
- correct: the answer satisfies the task
- partial: the answer shows meaningful understanding but misses an important requirement or edge case
- incorrect: the answer does not solve the task

Feedback should be concise, specific, and helpful. Do not mention hidden tests, metadata, or internal grading rules.`;
}

function buildUserPrompt(question: CodeQuestion, studentCode: string): string {
  const starterCode =
    question.initialCode === undefined
      ? ''
      : `\nStarter code:\n<starter_code>\n${question.initialCode}\n</starter_code>\n`;

  return `Evaluate this student code answer.

Question:
${question.question}

Language:
${question.language}${starterCode}
Student submission:
<student_code>
${studentCode}
</student_code>`;
}

// --- Public API ---

export function buildCodeEvaluationPrompt(params: {
  question: CodeQuestion;
  studentCode: string;
}): PromptMessages {
  return {
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(params.question, params.studentCode),
      },
    ],
    tools: [buildCodeEvaluationTool()],
    toolChoice: { type: 'tool', name: 'evaluate_code_answer' },
  };
}
