// --- Quiz Generation Prompt ---
// Generates a burst of quiz questions for one topic.
// Uses all 5 OpenQuizzer question types: MCQ, numeric input,
// ordering, multi-select, two-stage.

import type { PromptMessages } from './types.js';

export const QUIZ_GENERATION_VERSION = '1.3';

// --- Tool Schema ---

function buildQuizTool(count: number = 3) {
  return {
    name: 'create_quiz_questions',
    description:
      `Generate ${count} quiz questions for a single topic. ` +
      'Use a mix of question types. Questions must be self-contained — ' +
      'a student should understand the question without needing to reference source material.',
    inputSchema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          description: 'Array of quiz questions',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: [
                  'multiple-choice',
                  'numeric-input',
                  'ordering',
                  'multi-select',
                  'two-stage',
                  'checklist',
                  'code',
                  'self-evaluation',
                ],
                description: 'The question type',
              },
              question: {
                type: 'string',
                description: 'The question text',
              },
              // Multiple choice, multi-select, two-stage, checklist, self-evaluation
              options: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Answer options (for multiple-choice, multi-select, two-stage, self-evaluation)',
              },
              correctIndex: {
                type: 'number',
                description:
                  'Index of the correct option (for multiple-choice, two-stage)',
              },
              // Numeric input fields
              correctValue: {
                type: 'number',
                description: 'The correct numeric answer (for numeric-input)',
              },
              tolerance: {
                type: 'number',
                description: 'Acceptable tolerance (for numeric-input)',
              },
              unit: {
                type: 'string',
                description: 'Unit of measurement (for numeric-input)',
              },
              // Ordering, checklist
              items: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Items to be ordered or checked off (for ordering, checklist)',
              },
              correctOrder: {
                type: 'array',
                items: { type: 'number' },
                description:
                  'Correct sequence as indices into items array (for ordering)',
              },
              // Multi-select fields
              correctIndices: {
                type: 'array',
                items: { type: 'number' },
                description: 'Indices of all correct options (for multi-select)',
              },
              // Two-stage fields
              followUp: {
                type: 'string',
                description: 'Follow-up question text (for two-stage)',
              },
              followUpOptions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Follow-up answer options (for two-stage)',
              },
              followUpCorrectIndex: {
                type: 'number',
                description: 'Index of the correct follow-up option (for two-stage)',
              },
              // Code fields
              language: {
                type: 'string',
                description: 'Programming language (for code)',
              },
              initialCode: {
                type: 'string',
                description: 'Starter code provided to the student (for code)',
              },
              expectedPattern: {
                type: 'string',
                description:
                  'Regex pattern to check student code for correctness (for code)',
              },
            },
            required: ['type', 'question'],
          },
          minItems: count,
          maxItems: count,
        },
      },
      required: ['questions'],
    },
  };
}

// --- Prompt Builders ---

function buildSystemPrompt(): string {
  return `You are an expert quiz designer creating questions to test understanding of specific topics. Your questions emphasize active recall.

Question type guidelines:
- **multiple-choice**: 4 options, exactly 1 correct. Options should be plausible — no joke answers.
- **numeric-input**: Ask for a specific number. Include tolerance if approximate answers are acceptable. Include unit if applicable.
- **ordering**: 3-5 items that have a natural sequence (chronological, logical steps, ranked). Provide items in a shuffled order; correctOrder gives the right sequence as indices.
- **multi-select**: 4-6 options, 2-3 correct. Clearly ask "select ALL that apply."
- **two-stage**: First question + follow-up. Both are multiple-choice. The follow-up probes deeper understanding.
- **checklist**: Used for practical tasks or procedures. List 3-5 specific steps the student should perform or verify.
- **code**: Ask the student to write a short code snippet. Provide the programming language and optionally some initial code. Use expectedPattern to provide a regex that verifies key parts of the solution.
- **self-evaluation**: Used for open-ended or subjective practical mastery. Provide 2-4 levels of mastery as options (e.g., "I can do this reliably", "I need more practice").

Quality rules:
- Questions must be self-contained — answerable without the source material
- All options should be similar in length and specificity — don't make the correct answer the only detailed one
- Don't ask about publication metadata, authors, edition numbers, or page references
- Don't use "all of the above" or "none of the above"
- Vary question types within a burst — don't use the same type for every question`;
}

function buildUserPrompt(
  topicTitle: string,
  topicDescription: string,
  courseTitle: string,
  sectionTitle: string,
  explanationContent: string,
  count: number = 3
): string {
  return `Generate exactly ${count} quiz questions for the following topic.

Course: ${courseTitle}
Section: ${sectionTitle}
Topic: ${topicTitle}
Description: ${topicDescription}

The student just read this explanation:
<explanation>
${explanationContent}
</explanation>

Generate questions that test understanding of this topic. Use a mix of question types.`;
}

// --- Public API ---

export function buildQuizGenerationPrompt(params: {
  topicTitle: string;
  topicDescription: string;
  courseTitle: string;
  sectionTitle: string;
  explanationContent: string;
  questionCount?: number;
}): PromptMessages {
  const count = params.questionCount ?? 3;
  return {
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(
          params.topicTitle,
          params.topicDescription,
          params.courseTitle,
          params.sectionTitle,
          params.explanationContent,
          count
        ),
      },
    ],
    tools: [buildQuizTool(count)],
    toolChoice: { type: 'tool', name: 'create_quiz_questions' },
  };
}
