import type { Section } from '../curriculum/types.js';
import type { ContentItem } from './types.js';
import type { ContentGenerator } from './ContentGenerator.js';

export type ApiCallEventHandler = (payload: {
  purpose: string;
  status: 'start' | 'complete';
}) => void;

/**
 * Orchestrates the content generation lifecycle.
 * Acts as the bridge between CourseEngine and the generator/provider.
 */
export class ContentManager {
  #generator: ContentGenerator;
  #onApiCall: ApiCallEventHandler;

  constructor(generator: ContentGenerator, onApiCall: ApiCallEventHandler) {
    this.#generator = generator;
    this.#onApiCall = onApiCall;
  }

  /**
   * Generates all content for a section.
   * Emits apiCallStart/Complete events for each topic's generation steps.
   */
  async generateSection(section: Section, courseTitle: string): Promise<ContentItem[]> {
    const items: ContentItem[] = [];

    for (const topic of section.topics) {
      // 1. Explanation
      this.#onApiCall({
        purpose: `Explanation for topic: ${topic.title}`,
        status: 'start',
      });
      let explanation;
      try {
        explanation = await this.#generator.generateTopicExplanation(
          topic,
          courseTitle,
          section.title
        );
      } finally {
        this.#onApiCall({
          purpose: `Explanation for topic: ${topic.title}`,
          status: 'complete',
        });
      }
      items.push(explanation);

      // 2. Quiz Burst
      this.#onApiCall({
        purpose: `Quiz for topic: ${topic.title}`,
        status: 'start',
      });
      try {
        const questions = await this.#generator.generateTopicQuizBurst(
          topic,
          courseTitle,
          section.title,
          explanation.content
        );
        items.push(...questions);
      } finally {
        this.#onApiCall({
          purpose: `Quiz for topic: ${topic.title}`,
          status: 'complete',
        });
      }
    }

    return items;
  }
}
