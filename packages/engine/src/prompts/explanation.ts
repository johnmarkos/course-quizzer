// --- Explanation Prompt ---
// Generates a focused 2-3 paragraph explanation for one topic.
// The explanation exists to give the student something to be quizzed on —
// it is the means, not the end (see Learning Model in AGENTS.md).

import type { PromptMessages } from './types.js';

export const EXPLANATION_VERSION = '1.0';

// --- Tool Schema ---

const EXPLANATION_TOOL = {
  name: 'create_explanation',
  description:
    'Create a focused, concise explanation of a topic for a student. ' +
    'The explanation should be 2-3 paragraphs and give the student enough ' +
    'understanding to answer quiz questions about the topic.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'A clear title for this explanation',
      },
      content: {
        type: 'string',
        description:
          'The explanation text in markdown. 2-3 paragraphs. ' +
          'Focused, clear, and self-contained.',
      },
    },
    required: ['title', 'content'],
  },
};

// --- Prompt Builders ---

function buildSystemPrompt(): string {
  return `You are an expert tutor creating concise learning material. Your explanations are brief, focused, and designed to prepare students for quiz questions.

Guidelines:
- Write 2-3 paragraphs maximum
- Use concrete examples where possible
- Define key terms on first use
- Stay within the scope of the topic — don't wander into adjacent concepts
- Write at an introductory level unless the topic description indicates otherwise
- Use markdown formatting for clarity (bold key terms, code blocks for code)`;
}

function buildUserPrompt(
  topicTitle: string,
  topicDescription: string,
  courseTitle: string,
  sectionTitle: string
): string {
  return `Create a brief explanation for the following topic.

Course: ${courseTitle}
Section: ${sectionTitle}
Topic: ${topicTitle}
Description: ${topicDescription}

Write a focused 2-3 paragraph explanation that prepares the student to answer quiz questions on this topic.`;
}

// --- Public API ---

export function buildExplanationPrompt(params: {
  topicTitle: string;
  topicDescription: string;
  courseTitle: string;
  sectionTitle: string;
}): PromptMessages {
  return {
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(
          params.topicTitle,
          params.topicDescription,
          params.courseTitle,
          params.sectionTitle
        ),
      },
    ],
    tools: [EXPLANATION_TOOL],
    toolChoice: { type: 'tool', name: 'create_explanation' },
  };
}
