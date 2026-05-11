import type { Section } from '../curriculum/types.js';
import { AdaptiveSelector } from '../student/AdaptiveSelector.js';
import type { StudentModel } from '../student/StudentModel.js';
import type { ContentItem } from './types.js';
import type { TopicContentGenerator } from './ContentGenerator.js';

export type ApiCallEventHandler = (payload: {
  id: string;
  purpose: string;
  status: 'start' | 'complete';
}) => void;

/**
 * Orchestrates the content generation lifecycle.
 * Acts as the bridge between CourseEngine and the generator/provider.
 */
export class ContentManager {
  #generator: TopicContentGenerator;
  #onApiCall: ApiCallEventHandler;
  #apiCallSequence = 0;

  constructor(generator: TopicContentGenerator, onApiCall: ApiCallEventHandler) {
    this.#generator = generator;
    this.#onApiCall = onApiCall;
  }

  /**
   * Generates all content for a section.
   * Emits apiCallStart/Complete events for each topic's generation steps.
   */
  async generateSection(
    section: Section,
    courseTitle: string,
    studentModel?: StudentModel
  ): Promise<ContentItem[]> {
    const items: ContentItem[] = [];
    const adaptiveSelector = studentModel ? new AdaptiveSelector(studentModel) : null;

    for (const topic of section.topics) {
      // 1. Explanation
      const explanation = await this.#withApiCall(
        `Explanation for topic: ${topic.title}`,
        () => this.#generator.generateTopicExplanation(topic, courseTitle, section.title)
      );
      items.push(explanation);

      // 2. Quiz Burst
      const questions = await this.#withApiCall(`Quiz for topic: ${topic.title}`, () => {
        const questionCount =
          adaptiveSelector?.getTopicConfig(topic.id).targetQuestionCount ?? 3;
        return this.#generator.generateTopicQuizBurst(
          topic,
          courseTitle,
          section.title,
          explanation.content,
          questionCount
        );
      });
      items.push(...questions);
    }

    return items;
  }

  async #withApiCall<T>(purpose: string, generate: () => Promise<T>): Promise<T> {
    const id = this.#nextApiCallId();
    this.#onApiCall({ id, purpose, status: 'start' });
    try {
      return await generate();
    } finally {
      this.#onApiCall({ id, purpose, status: 'complete' });
    }
  }

  #nextApiCallId(): string {
    this.#apiCallSequence += 1;
    return `api-call-${this.#apiCallSequence}`;
  }
}
