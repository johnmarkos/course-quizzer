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
import type { ClaudeProvider } from '../provider/ClaudeProvider.js';
import type { ToolUseBlock } from '../provider/types.js';
import type { Topic } from '../curriculum/types.js';
import type { Explanation, Question, QuestionType } from './types.js';

const EXPLANATION_MAX_TOKENS = 1024;
const QUIZ_MAX_TOKENS = 4096;

export class ContentGenerator {
  #provider: ClaudeProvider;

  constructor(provider: ClaudeProvider) {
    this.#provider = provider;
  }

  // --- Topic Generation ---

  async generateTopicExplanation(
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

  async generateTopicQuizBurst(
    topic: Topic,
    courseTitle: string,
    sectionTitle: string,
    explanationContent: string,
    questionCount: number = 3
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

      return this.#parseAndFilterQuestions(retryBlock, topic.id, questionCount);
    }

    return this.#parseAndFilterQuestions(toolBlock, topic.id, questionCount);
  }

  #parseAndFilterQuestions(
    block: ToolUseBlock,
    topicId: string,
    expectedQuestionCount: number
  ): Question[] {
    const input = block.input as Record<string, unknown>;
    const rawQuestions = input.questions;

    if (!Array.isArray(rawQuestions)) {
      throw new Error(`No questions generated for topic "${topicId}"`);
    }

    this.#assertQuestionCount(topicId, rawQuestions.length, expectedQuestionCount);

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

    this.#assertQuestionCount(topicId, questions.length, expectedQuestionCount, true);

    return questions;
  }

  #assertQuestionCount(
    topicId: string,
    actualCount: number,
    expectedCount: number,
    afterValidation: boolean = false
  ): void {
    if (actualCount === expectedCount) {
      return;
    }

    const validationSuffix = afterValidation ? ' after validation' : '';
    throw new Error(
      `Expected exactly ${expectedCount} questions for topic "${topicId}", got ${actualCount}${validationSuffix}`
    );
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
      case 'checklist':
        return this.#parseChecklist(obj, id, topicId, questionText);
      case 'code':
        return this.#parseCode(obj, id, topicId, questionText);
      case 'self-evaluation':
        return this.#parseSelfEvaluation(obj, id, topicId, questionText);
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

    return {
      type: 'multiple-choice',
      id,
      topicId,
      question,
      options,
      correctIndex,
    };
  }

  #parseNumeric(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const correctValue = this.#requireNumber(obj.correctValue, 'correctValue');
    const tolerance =
      obj.tolerance === undefined ? 0 : this.#requireNumber(obj.tolerance, 'tolerance');

    if (tolerance < 0) {
      throw new Error('Numeric tolerance must be non-negative');
    }

    return {
      type: 'numeric-input',
      id,
      topicId,
      question,
      correctValue,
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
    const correctOrder = this.#requireNumberArray(
      obj.correctOrder,
      'correctOrder',
      items.length
    );

    if (new Set(correctOrder).size !== items.length) {
      throw new Error('correctOrder must contain each index exactly once');
    }

    for (const index of correctOrder) {
      if (index < 0 || index >= items.length) {
        throw new Error('correctOrder index out of range');
      }
    }

    return {
      type: 'ordering',
      id,
      topicId,
      question,
      items,
      correctOrder,
    };
  }

  #parseMultiSelect(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const options = this.#requireStringArray(obj.options, 'options', 2);
    const correctIndices = this.#requireNumberArray(
      obj.correctIndices,
      'correctIndices',
      1
    );

    for (const index of correctIndices) {
      if (index < 0 || index >= options.length) {
        throw new Error('correctIndices index out of range');
      }
    }

    return {
      type: 'multi-select',
      id,
      topicId,
      question,
      options,
      correctIndices,
    };
  }

  #parseTwoStage(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const options = this.#requireStringArray(obj.options, 'options', 2);
    const correctIndex = this.#requireIndex(obj.correctIndex, options.length);
    const followUp = this.#requireString(obj.followUp, 'followUp');
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

  #parseChecklist(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const items = this.#requireStringArray(obj.items, 'items', 1);

    return {
      type: 'checklist',
      id,
      topicId,
      question,
      items,
    };
  }

  #parseCode(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const language = this.#requireString(obj.language, 'language');
    const initialCode =
      typeof obj.initialCode === 'string' ? obj.initialCode : undefined;
    const expectedPattern =
      typeof obj.expectedPattern === 'string' ? obj.expectedPattern : undefined;

    return {
      type: 'code',
      id,
      topicId,
      question,
      language,
      initialCode,
      expectedPattern,
    };
  }

  #parseSelfEvaluation(
    obj: Record<string, unknown>,
    id: string,
    topicId: string,
    question: string
  ): Question {
    const options = this.#requireStringArray(obj.options, 'options', 2);

    return {
      type: 'self-evaluation',
      id,
      topicId,
      question,
      options,
    };
  }

  // --- Validation Helpers ---

  #requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Missing or invalid ${field}`);
    }
    return value;
  }

  #requireNumber(value: unknown, field: string): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error(`Missing or invalid ${field}`);
    }
    return value;
  }

  #requireIndex(value: unknown, length: number): number {
    const index = this.#requireNumber(value, 'index');
    if (!Number.isInteger(index) || index < 0 || index >= length) {
      throw new Error('Index out of range');
    }
    return index;
  }

  #requireStringArray(value: unknown, field: string, minLength: number): string[] {
    if (!Array.isArray(value) || value.length < minLength) {
      throw new Error(`Missing or invalid ${field}`);
    }

    const strings = value.filter((item): item is string => typeof item === 'string');
    if (strings.length !== value.length) {
      throw new Error(`${field} must be an array of strings`);
    }

    return [...strings];
  }

  #requireNumberArray(value: unknown, field: string, minLength: number): number[] {
    if (!Array.isArray(value) || value.length < minLength) {
      throw new Error(`Missing or invalid ${field}`);
    }

    const numbers = value.filter(
      (item): item is number => typeof item === 'number' && !Number.isNaN(item)
    );
    if (numbers.length !== value.length) {
      throw new Error(`${field} must be an array of numbers`);
    }

    return [...numbers];
  }
}
