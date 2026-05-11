// --- SyllabusParser ---
// Orchestrates the syllabus → CurriculumPlan pipeline:
//   1. Build the prompt from raw syllabus text
//   2. Send to the configured provider
//   3. Parse and validate the response
//   4. Retry once on malformed response
//
// This class sits between the prompt layer and the provider layer.
// It doesn't know about Anthropic-specific details — it works through
// ProviderRequest/ProviderResponse types.

import { buildSyllabusAnalysisPrompt } from '../prompts/syllabus-analysis.js';
import type {
  ProviderClient,
  ProviderResponse,
  ToolUseBlock,
} from '../provider/types.js';
import type { CurriculumPlan, Section, Topic } from './types.js';

const MAX_TOKENS = 4096;

export class SyllabusParser {
  #provider: ProviderClient;

  constructor(provider: ProviderClient) {
    this.#provider = provider;
  }

  // --- Public API ---

  /**
   * Parse a raw syllabus text into a structured CurriculumPlan.
   * Retries once if the response is malformed.
   */
  async parse(syllabusText: string): Promise<CurriculumPlan> {
    const prompt = buildSyllabusAnalysisPrompt(syllabusText);

    let response = await this.#provider.sendMessage({
      ...prompt,
      maxTokens: MAX_TOKENS,
    });

    // Try to extract and validate the plan
    try {
      return this.#extractPlan(response);
    } catch (firstError) {
      // Retry once on malformed response
      try {
        response = await this.#provider.sendMessage({
          ...prompt,
          maxTokens: MAX_TOKENS,
        });
        return this.#extractPlan(response);
      } catch {
        // Throw the original error — it's more informative
        throw firstError;
      }
    }
  }

  // --- Response Extraction ---

  #extractPlan(response: ProviderResponse): CurriculumPlan {
    const toolBlock = response.content.find(
      (block): block is ToolUseBlock =>
        block.type === 'tool_use' && block.name === 'create_curriculum_plan'
    );

    if (!toolBlock) {
      throw new Error(
        'Syllabus analysis response did not contain a create_curriculum_plan tool use'
      );
    }

    return validateCurriculumPlan(toolBlock.input);
  }
}

// --- Validation ---
// Validates the raw tool_use input against the CurriculumPlan shape.
// This is the trust boundary — everything from the LLM is untrusted.

export function validateCurriculumPlan(raw: unknown): CurriculumPlan {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Expected curriculum plan to be an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    throw new Error('Curriculum plan missing or empty "title"');
  }

  if (typeof obj.description !== 'string' || obj.description.length === 0) {
    throw new Error('Curriculum plan missing or empty "description"');
  }

  if (!Array.isArray(obj.sections) || obj.sections.length === 0) {
    throw new Error('Curriculum plan missing or empty "sections"');
  }

  const seenSectionIds = new Set<string>();
  const seenTopicIds = new Set<string>();

  const sections: Section[] = obj.sections.map((rawSection: unknown, index: number) => {
    const section = validateSection(rawSection, index, seenSectionIds, seenTopicIds);
    return section;
  });

  return {
    title: obj.title,
    description: obj.description,
    sections,
  };
}

function validateSection(
  raw: unknown,
  index: number,
  seenSectionIds: Set<string>,
  seenTopicIds: Set<string>
): Section {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Section at index ${index} is not an object`);
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error(`Section at index ${index} missing or empty "id"`);
  }

  if (seenSectionIds.has(obj.id)) {
    throw new Error(`Duplicate section id: "${obj.id}"`);
  }
  seenSectionIds.add(obj.id);

  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    throw new Error(`Section "${obj.id}" missing or empty "title"`);
  }

  if (typeof obj.order !== 'number') {
    throw new Error(`Section "${obj.id}" missing or invalid "order"`);
  }

  if (!Array.isArray(obj.topics) || obj.topics.length === 0) {
    throw new Error(`Section "${obj.id}" missing or empty "topics"`);
  }

  const topics: Topic[] = obj.topics.map((rawTopic: unknown, topicIndex: number) =>
    validateTopic(rawTopic, obj.id as string, topicIndex, seenTopicIds)
  );

  return {
    id: obj.id,
    title: obj.title,
    order: obj.order,
    topics,
  };
}

function validateTopic(
  raw: unknown,
  sectionId: string,
  index: number,
  seenTopicIds: Set<string>
): Topic {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Topic at index ${index} in section "${sectionId}" is not an object`);
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error(
      `Topic at index ${index} in section "${sectionId}" missing or empty "id"`
    );
  }

  if (seenTopicIds.has(obj.id)) {
    throw new Error(`Duplicate topic id: "${obj.id}"`);
  }
  seenTopicIds.add(obj.id);

  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    throw new Error(`Topic "${obj.id}" missing or empty "title"`);
  }

  if (typeof obj.description !== 'string' || obj.description.length === 0) {
    throw new Error(`Topic "${obj.id}" missing or empty "description"`);
  }

  return {
    id: obj.id,
    title: obj.title,
    description: obj.description,
  };
}
