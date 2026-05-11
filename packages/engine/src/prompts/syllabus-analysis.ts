// --- Syllabus Analysis Prompt ---
// Analyzes raw syllabus text and produces a structured CurriculumPlan.
// Version constant tracks prompt changes for traceability in git history.
//
// Architecture rules:
//   - System prompt defines Claude's role and output format
//   - User-provided syllabus text goes in the user message (untrusted input)
//   - Output is requested as structured JSON via tool_use

import type { PromptMessages } from './types.js';

export const SYLLABUS_ANALYSIS_VERSION = '1.0';

// --- Tool Schema ---
// Defines the expected JSON shape for the curriculum plan.
// Using tool_use ensures Claude returns structured output we can parse.

const CURRICULUM_PLAN_TOOL = {
  name: 'create_curriculum_plan',
  description:
    'Create a structured curriculum plan from a course syllabus. ' +
    'Break the course into ordered sections, each with focused topics ' +
    'that can be taught and quizzed independently.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description:
          'A concise title for the course (e.g., "Introduction to Machine Learning")',
      },
      description: {
        type: 'string',
        description: 'A 1-2 sentence description of what the course covers',
      },
      sections: {
        type: 'array',
        description: 'Ordered list of course sections, from foundational to advanced',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description:
                'A unique kebab-case identifier (e.g., "intro-to-ml", "linear-regression")',
            },
            title: {
              type: 'string',
              description: 'Human-readable section title',
            },
            order: {
              type: 'number',
              description: 'Zero-based position in the sequence',
            },
            topics: {
              type: 'array',
              description: 'Key concepts within this section that can be quizzed',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'A unique kebab-case identifier for this topic',
                  },
                  title: {
                    type: 'string',
                    description: 'Human-readable topic title',
                  },
                  description: {
                    type: 'string',
                    description:
                      'A brief description of what this topic covers (1-2 sentences)',
                  },
                },
                required: ['id', 'title', 'description'],
              },
              minItems: 1,
            },
          },
          required: ['id', 'title', 'order', 'topics'],
        },
        minItems: 1,
      },
    },
    required: ['title', 'description', 'sections'],
  },
};

// --- System Prompt ---

function buildSystemPrompt(): string {
  return `You are an expert curriculum designer. Your job is to analyze a course syllabus and create a structured learning plan.

Guidelines:
- Break the course into 4-12 sections, ordered from foundational to advanced
- Each section should have 2-6 focused topics that can be independently taught and quizzed
- Topic descriptions should be specific enough to generate quiz questions from
- Use the course's own terminology and scope — don't add topics that aren't in the syllabus
- Section and topic IDs should be kebab-case, descriptive, and unique across the plan
- Order sections so prerequisites come first
- If the syllabus is informal or brief, infer reasonable structure from the content described

Do NOT include:
- Meta-topics like "course overview" or "final exam review"
- Publication metadata, author info, or textbook details
- Topics outside the scope of the syllabus`;
}

// --- User Prompt ---

function buildUserPrompt(syllabusText: string): string {
  return `Analyze the following course syllabus and create a structured curriculum plan.

<syllabus>
${syllabusText}
</syllabus>`;
}

// --- Public API ---

/**
 * Build the complete prompt for syllabus analysis.
 * Returns PromptMessages ready to be sent via a provider client
 * (caller adds maxTokens).
 */
export function buildSyllabusAnalysisPrompt(syllabusText: string): PromptMessages {
  return {
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(syllabusText) }],
    tools: [CURRICULUM_PLAN_TOOL],
    toolChoice: { type: 'tool', name: 'create_curriculum_plan' },
  };
}
