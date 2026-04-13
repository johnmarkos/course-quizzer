// --- ContentGenerator ---
// Produces the content/quiz loop for a single section:
// For each topic in the section, generates a brief explanation
// followed by a burst of quiz questions.
//
// The output is a flat ContentItem[] array that the CourseEngine
// feeds through its state machine. The generator doesn't know
// about engine state — it just produces content.
//
// Flow per topic:
//   1. Generate explanation via Claude → Explanation item
//   2. Generate quiz burst via Claude → Question items
//   3. Validate and filter questions
// Repeat for each topic in the section.

import { buildExplanationPrompt } from '../prompts/explanation.js';
import { buildQuizGenerationPrompt } from '../prompts/quiz-generation.js';
import { checkQuestionQuality } from './quality-filters.js';
import { AdaptiveSelector } from '../student/AdaptiveSelector.js';
import type { ClaudeProvider } from '../provider/ClaudeProvider.js';
import type { ToolUseBlock } from '../provider/types.js';
import type { Section, Topic } from '../curriculum/types.js';
import type { ContentItem, Explanation, Question, QuestionType } from './types.js';
import type { StudentModel } from '../student/StudentModel.js';

const EXPLANATION_MAX_TOKENS = 1024;
const QUIZ_MAX_TOKENS = 4096;

export class ContentGenerator {
  #provider: ClaudeProvider;

  constructor(provider: ClaudeProvider) {
    this.#provider = provider;
  }

  // --- Public API ---

  /**
   * Generate content items for an entire section.
   * Returns a flat array: [explanation, questions..., explanation, questions..., ...]
   * following the content/quiz loop from the Learning Model.
   */
  async generateSection(
    section: Section,
    courseTitle: string,
    studentModel?: StudentModel
  ): Promise<ContentItem[]> {
    const items: ContentItem[] = [];

    for (const topic of section.topics) {
      const explanation = await this.#generateExplanation(
        topic,
        courseTitle,
        section.title
      );
      items.push(explanation);

      const questionCount = studentModel
        ? AdaptiveSelector.getQuestionCount(studentModel, topic.id)
        : 3;

      const questions = await this.#generateQuizBurst(
        topic,
        courseTitle,
        section.title,
        explanation.content,
        questionCount
      );
      items.push(...questions);
    }

    return items;
  }

  // --- Explanation Generation ---

  async #generateExplanation(
    topic: Topic,
    courseTitle: string,
    sectionTitle: string
  ): Promise<Explanation> {
    const prompt = buildExplanationPrompt({
      topicTitle: topic.title,
      topicDescription: topic.description,
      courseTitle,
      sectionTitle,
    });

    const response = await this.#provider.sendMessage({
      ...prompt,
      maxTokens: EXPLANATION_MAX_TOKENS,
    });

    const toolBlock = response.content.find(
      (block): block is ToolUseBlock =>
        block.type === 'tool_use' && block.name === 'create_explanation'
    );

    if (!toolBlock) {
      // Retry once
      const retryResponse = await this.#provider.sendMessage({
        ...prompt,
        maxTokens: EXPLANATION_MAX_TOKENS,
      });

      const retryBlock = retryResponse.content.find(
        (block): block is ToolUseBlock =>
          block.type === 'tool_use' && block.name === 'create_explanation'
      );

      if (!retryBlock) {
        throw new Error(
          `Failed to generate explanation for topic "${topic.title}" after retry`
        );
      }

      return this.#parseExplanation(retryBlock, topic.id);
    }

    return this.#parseExplanation(toolBlock, topic.id);
  }

  #parseExplanation(block: ToolUseBlock, topicId: string): Explanation {
    const input = block.input as Record<string, unknown>;

    const title = typeof input.title === 'string' ? input.title : 'Explanation';
    const content = typeof input.content === 'string' ? input.content : '';

    if (content.length === 0) {
      throw new Error(`Empty explanation content for topic "${topicId}"`);
    }

    return {
      type: 'explanation',
      topicId,
      title,
      content,
    };
  }

  // --- Quiz Generation ---

  async #generateQuizBurst(
    topic: Topic,
    courseTitle: string,
    sectionTitle: string,
    explanationContent: string,
    questionCount: number
  ): Promise<Question[]> {
    const prompt = buildQuizGenerationPrompt({
      topicTitle: topic.title,
      topicDescription: topic.description,
      courseTitle,
      sectionTitle,
      explanationContent,
      questionCount,
    });

    const response = await this.#provider.sendMessage({
      ...prompt,
      maxTokens: QUIZ_MAX_TOKENS,
    });

    const toolBlock = response.content.find(
      (block): block is ToolUseBlock =>
        block.type === 'tool_use' && block.name === 'create_quiz_questions'
    );

    if (!toolBlock) {
      // Retry once
      const retryResponse = await this.#provider.sendMessage({
        ...prompt,
        maxTokens: QUIZ_MAX_TOKENS,
      });

      const retryBlock = retryResponse.content.find(
        (block): block is ToolUseBlock =>
          block.type === 'tool_use' && block.name === 'create_quiz_questions'
      );

      if (!retryBlock) {
        throw new Error(`Failed to generate quiz for topic "${topic.title}" after retry`);
      }

      return this.#parseAndFilterQuestions(retryBlock, topic.id);
    }

    return this.#parseAndFilterQuestions(toolBlock, topic.id);
  }

  #parseAndFilterQuestions(block: ToolUseBlock, topicId: string): Question[] {
    const input = block.input as Record<string, unknown>;
    const rawQuestions = input.questions;

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      throw new Error(`No questions generated for topic "${topicId}"`);
    }

    const questions: Question[] = [];
    let idCounter = 0;

    for (const raw of rawQuestions) {
      try {
        const question = this.#parseQuestion(raw, topicId, idCounter++);
        const issues = checkQuestionQuality(question);
        if (issues.length === 0) {
          questions.push(question);
        }
        // Silently drop questions that fail quality filters
      } catch {
        // Silently skip unparseable questions — better to have fewer
        // good questions than to fail the entire section
      }
    }

    if (questions.length === 0) {
      throw new Error(`All generated questions for topic "${topicId}" failed validation`);
    }

    return questions;
  }

  // --- Question Parsing ---

  #parseQuestion(raw: unknown, topicId: string, index: number): Question {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error('Question is not an object');
    }

    const obj = raw as Record<string, unknown>;
    const type = obj.type as QuestionType;
    const questionText = obj.question as string;

    if (!questionText || typeof questionText !== 'string') {
      throw new Error('Question missing text');
    }

    const id = `${topicId}-q${index}`;

    switch (type) {
      case 'multiple-choice':
        return this.#parseMCQ(obj, id, topicId, questionText);
      case 'numeric-input':
        return this.#parseNumeric(obj, id, topicId, questionText);
      case 'ordering':
        return this.#parseOrdering(obj, id, topicId, questionText);
      case 'multi-select':
        return this.#parseMultiSelect(obj, id, topicId, questionText);
      case 'two-stage':
        return this.#parseTwoStage(obj, id, topicId, questionText);
      default:
        throw new Error(`Unknown question type: ${type}`);
    }
  }

  #parseMCQ(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const options = this.#requireStringArray(obj.options, 'options', 2);
    const correctIndex = this.#requireIndex(obj.correctIndex, options.length);

    return { type: 'multiple-choice', id, topicId, question, options, correctIndex };
  }

  #parseNumeric(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    if (typeof obj.correctValue !== 'number') {
      throw new Error('numeric-input missing correctValue');
    }

    const tolerance = typeof obj.tolerance === 'number' ? obj.tolerance : 0;
    if (tolerance < 0) {
      throw new Error('numeric-input tolerance must be >= 0');
    }

    return {
      type: 'numeric-input',
      id,
      topicId,
      question,
      correctValue: obj.correctValue,
      tolerance,
      unit: typeof obj.unit === 'string' ? obj.unit : undefined,
    };
  }

  #parseOrdering(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const items = this.#requireStringArray(obj.items, 'items', 2);
    const correctOrder = this.#requireNumberArray(obj.correctOrder, 'correctOrder');

    if (correctOrder.length !== items.length) {
      throw new Error('ordering: correctOrder length must match items length');
    }

    return { type: 'ordering', id, topicId, question, items, correctOrder };
  }

  #parseMultiSelect(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const options = this.#requireStringArray(obj.options, 'options', 2);
    const correctIndices = this.#requireNumberArray(obj.correctIndices, 'correctIndices');

    for (const idx of correctIndices) {
      if (idx < 0 || idx >= options.length) {
        throw new Error(
          `multi-select: correctIndices contains out-of-range index ${idx}`
        );
      }
    }

    return { type: 'multi-select', id, topicId, question, options, correctIndices };
  }

  #parseTwoStage(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const options = this.#requireStringArray(obj.options, 'options', 2);
    const correctIndex = this.#requireIndex(obj.correctIndex, options.length);
    const followUp = obj.followUp;
    if (typeof followUp !== 'string' || followUp.length === 0) {
      throw new Error('two-stage missing followUp');
    }
    const followUpOptions = this.#requireStringArray(
      obj.followUpOptions,
      'followUpOptions',
      2
    );
    const followUpCorrectIndex = this.#requireIndex(
      obj.followUpCorrectIndex,
      followUpOptions.length
    );

    return {
      type: 'two-stage',
      id,
      topicId,
      question,
      options,
      correctIndex,
      followUp,
      followUpOptions,
      followUpCorrectIndex,
    };
  }

  // --- Validation Helpers ---

  #requireStringArray(value: unknown, name: string, minLength: number): string[] {
    if (!Array.isArray(value) || value.length < minLength) {
      throw new Error(`${name} must be an array with at least ${minLength} items`);
    }
    for (const item of value) {
      if (typeof item !== 'string') {
        throw new Error(`${name} must contain only strings`);
      }
    }
    return value as string[];
  }

  #requireNumberArray(value: unknown, name: string): number[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`${name} must be a non-empty array`);
    }
    for (const item of value) {
      if (typeof item !== 'number') {
        throw new Error(`${name} must contain only numbers`);
      }
    }
    return value as number[];
  }

  #requireIndex(value: unknown, maxExclusive: number): number {
    if (typeof value !== 'number' || value < 0 || value >= maxExclusive) {
      throw new Error(`Index must be a number in [0, ${maxExclusive})`);
    }
    return value;
  }
}
