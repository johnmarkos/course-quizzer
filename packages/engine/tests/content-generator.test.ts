import { describe, it, expect, vi } from 'vitest';
import { ContentGenerator } from '../src/content/ContentGenerator.js';
import { checkQuestionQuality } from '../src/content/quality-filters.js';
import {
  buildExplanationPrompt,
  EXPLANATION_VERSION,
} from '../src/prompts/explanation.js';
import {
  buildQuizGenerationPrompt,
  QUIZ_GENERATION_VERSION,
} from '../src/prompts/quiz-generation.js';
import type { ClaudeProvider } from '../src/provider/ClaudeProvider.js';
import type { ProviderResponse } from '../src/provider/types.js';
import type { Section, Topic } from '../src/curriculum/types.js';
import type { Question } from '../src/content/types.js';
import {
  explanationResponse,
  quizResponse,
  textOnlyResponse,
  GOOD_MCQ,
  GOOD_NUMERIC,
  GOOD_ORDERING,
  GOOD_MULTI_SELECT,
  GOOD_TWO_STAGE,
  LENGTH_OUTLIER_MCQ,
  FRONT_MATTER_MCQ,
  DUPLICATE_OPTIONS_MCQ,
} from './fixtures/content-generation.js';

// --- Helpers ---

function mockProvider(...responses: ProviderResponse[]): ClaudeProvider {
  const fn = vi.fn();
  for (const response of responses) {
    fn.mockResolvedValueOnce(response);
  }
  return { sendMessage: fn } as unknown as ClaudeProvider;
}

const TOPIC: Topic = {
  id: 'binary-search',
  title: 'Binary Search',
  description: 'Searching a sorted array by repeatedly dividing the search interval.',
};

const SECTION: Section = {
  id: 'searching',
  title: 'Search Algorithms',
  order: 0,
  topics: [TOPIC],
};

const TWO_TOPIC_SECTION: Section = {
  id: 'sorting',
  title: 'Sorting',
  order: 1,
  topics: [
    {
      id: 'merge-sort',
      title: 'Merge Sort',
      description: 'A divide-and-conquer sorting algorithm.',
    },
    {
      id: 'quick-sort',
      title: 'Quick Sort',
      description: 'A partition-based sorting algorithm.',
    },
  ],
};

// --- Prompt Builders ---

describe('explanation prompt', () => {
  it('exports version constant', () => {
    expect(EXPLANATION_VERSION).toBe('1.0');
  });

  it('builds prompt with topic context', () => {
    const prompt = buildExplanationPrompt({
      topicTitle: 'Binary Search',
      topicDescription: 'Searching a sorted array',
      courseTitle: 'Algorithms',
      sectionTitle: 'Search',
    });

    expect(prompt.system).toContain('tutor');
    expect(prompt.messages[0].content).toContain('Binary Search');
    expect(prompt.messages[0].content).toContain('Algorithms');
    expect(prompt.tools![0].name).toBe('create_explanation');
    expect(prompt.toolChoice).toEqual({ type: 'tool', name: 'create_explanation' });
  });

  it('puts topic info in user message, not system prompt', () => {
    const prompt = buildExplanationPrompt({
      topicTitle: 'SECRET_TOPIC',
      topicDescription: 'SECRET_DESC',
      courseTitle: 'Course',
      sectionTitle: 'Section',
    });

    expect(prompt.messages[0].content).toContain('SECRET_TOPIC');
    expect(prompt.system).not.toContain('SECRET_TOPIC');
  });
});

describe('quiz generation prompt', () => {
  it('exports version constant', () => {
    expect(QUIZ_GENERATION_VERSION).toBe('1.0');
  });

  it('builds prompt with topic and explanation context', () => {
    const prompt = buildQuizGenerationPrompt({
      topicTitle: 'Binary Search',
      topicDescription: 'Searching a sorted array',
      courseTitle: 'Algorithms',
      sectionTitle: 'Search',
      explanationContent: 'Binary search works by...',
    });

    expect(prompt.system).toContain('quiz designer');
    expect(prompt.messages[0].content).toContain('Binary Search');
    expect(prompt.messages[0].content).toContain('Binary search works by...');
    expect(prompt.tools![0].name).toBe('create_quiz_questions');
  });

  it('system prompt includes quality rules', () => {
    const prompt = buildQuizGenerationPrompt({
      topicTitle: 'T',
      topicDescription: 'D',
      courseTitle: 'C',
      sectionTitle: 'S',
      explanationContent: 'E',
    });

    expect(prompt.system).toContain('self-contained');
    expect(prompt.system).toContain('similar in length');
    expect(prompt.system).toContain('metadata');
  });
});

// --- Quality Filters ---

describe('quality filters', () => {
  it('passes a good MCQ', () => {
    const q: Question = { ...GOOD_MCQ, id: 'q1', topicId: 't1' } as Question;
    expect(checkQuestionQuality(q)).toEqual([]);
  });

  it('flags length outlier', () => {
    const q: Question = { ...LENGTH_OUTLIER_MCQ, id: 'q1', topicId: 't1' } as Question;
    const issues = checkQuestionQuality(q);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].reason).toContain('longer');
  });

  it('flags front-matter question', () => {
    const q: Question = { ...FRONT_MATTER_MCQ, id: 'q1', topicId: 't1' } as Question;
    const issues = checkQuestionQuality(q);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].reason).toContain('metadata');
  });

  it('flags duplicate options', () => {
    const q: Question = { ...DUPLICATE_OPTIONS_MCQ, id: 'q1', topicId: 't1' } as Question;
    const issues = checkQuestionQuality(q);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].reason).toContain('duplicate');
  });

  it('passes numeric-input (no length check)', () => {
    const q: Question = { ...GOOD_NUMERIC, id: 'q1', topicId: 't1' } as Question;
    expect(checkQuestionQuality(q)).toEqual([]);
  });

  it('passes ordering (no length check)', () => {
    const q: Question = { ...GOOD_ORDERING, id: 'q1', topicId: 't1' } as Question;
    expect(checkQuestionQuality(q)).toEqual([]);
  });

  it('flags multi-select where a correct option is a length outlier', () => {
    const q: Question = {
      type: 'multi-select',
      id: 'q1',
      topicId: 't1',
      question: 'Select all correct answers:',
      options: [
        'A short answer that is a detailed and comprehensive explanation of the underlying concept covering multiple important aspects of the topic',
        'No',
        'Nope',
        'Wrong',
      ],
      correctIndices: [0],
    };
    const issues = checkQuestionQuality(q);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].reason).toContain('longer');
  });

  it('flags two-stage where followUp correct option is a length outlier', () => {
    const q: Question = {
      type: 'two-stage',
      id: 'q1',
      topicId: 't1',
      question: 'What is X?',
      options: ['A', 'B', 'C'],
      correctIndex: 0,
      followUp: 'Why?',
      followUpOptions: [
        'Because it is a well-defined computational procedure that takes values as input and produces values as output through a finite sequence of carefully designed steps',
        'No reason',
        'Just because',
      ],
      followUpCorrectIndex: 0,
    };
    const issues = checkQuestionQuality(q);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].reason).toContain('longer');
  });
});

// --- ContentGenerator ---

describe('ContentGenerator', () => {
  it('generates explanation + quiz burst for a single topic', async () => {
    const provider = mockProvider(
      explanationResponse('Binary Search', 'Binary search divides...'),
      quizResponse([GOOD_MCQ, GOOD_NUMERIC])
    );
    const gen = new ContentGenerator(provider);

    const items = await gen.generateSection(SECTION, 'Algorithms');

    expect(items).toHaveLength(3); // 1 explanation + 2 questions
    expect(items[0].type).toBe('explanation');
    expect(items[0].topicId).toBe('binary-search');
    expect(items[1].type).toBe('multiple-choice');
    expect(items[2].type).toBe('numeric-input');
  });

  it('generates content for multiple topics in order', async () => {
    const provider = mockProvider(
      // Topic 1: merge-sort
      explanationResponse('Merge Sort', 'Merge sort divides...'),
      quizResponse([GOOD_MCQ]),
      // Topic 2: quick-sort
      explanationResponse('Quick Sort', 'Quick sort partitions...'),
      quizResponse([GOOD_ORDERING])
    );
    const gen = new ContentGenerator(provider);

    const items = await gen.generateSection(TWO_TOPIC_SECTION, 'Algorithms');

    expect(items).toHaveLength(4); // 2 explanations + 2 questions
    expect(items[0].type).toBe('explanation');
    expect(items[0].topicId).toBe('merge-sort');
    expect(items[1].topicId).toBe('merge-sort');
    expect(items[2].type).toBe('explanation');
    expect(items[2].topicId).toBe('quick-sort');
    expect(items[3].topicId).toBe('quick-sort');
  });

  it('parses all 5 question types', async () => {
    const provider = mockProvider(
      explanationResponse('Topic', 'Content...'),
      quizResponse([
        GOOD_MCQ,
        GOOD_NUMERIC,
        GOOD_ORDERING,
        GOOD_MULTI_SELECT,
        GOOD_TWO_STAGE,
      ])
    );
    const gen = new ContentGenerator(provider);

    const items = await gen.generateSection(SECTION, 'Course');
    const questions = items.filter((i) => i.type !== 'explanation');

    expect(questions).toHaveLength(5);
    const types = questions.map((q) => q.type);
    expect(types).toContain('multiple-choice');
    expect(types).toContain('numeric-input');
    expect(types).toContain('ordering');
    expect(types).toContain('multi-select');
    expect(types).toContain('two-stage');
  });

  it('filters out low-quality questions silently', async () => {
    const provider = mockProvider(
      explanationResponse('Topic', 'Content...'),
      quizResponse([GOOD_MCQ, LENGTH_OUTLIER_MCQ, FRONT_MATTER_MCQ, GOOD_NUMERIC])
    );
    const gen = new ContentGenerator(provider);

    const items = await gen.generateSection(SECTION, 'Course');
    const questions = items.filter((i) => i.type !== 'explanation');

    // LENGTH_OUTLIER_MCQ and FRONT_MATTER_MCQ should be filtered out
    expect(questions).toHaveLength(2);
  });

  it('retries explanation on malformed response', async () => {
    const provider = mockProvider(
      textOnlyResponse(), // first attempt fails
      explanationResponse('Binary Search', 'Content...'), // retry succeeds
      quizResponse([GOOD_MCQ])
    );
    const gen = new ContentGenerator(provider);

    const items = await gen.generateSection(SECTION, 'Course');

    expect(items[0].type).toBe('explanation');
    expect((provider.sendMessage as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
  });

  it('retries quiz on malformed response', async () => {
    const provider = mockProvider(
      explanationResponse('Topic', 'Content...'),
      textOnlyResponse(), // first quiz attempt fails
      quizResponse([GOOD_MCQ]) // retry succeeds
    );
    const gen = new ContentGenerator(provider);

    const items = await gen.generateSection(SECTION, 'Course');

    expect(items).toHaveLength(2); // explanation + 1 question
  });

  it('throws after retry if explanation still fails', async () => {
    const provider = mockProvider(textOnlyResponse(), textOnlyResponse());
    const gen = new ContentGenerator(provider);

    await expect(gen.generateSection(SECTION, 'Course')).rejects.toThrow(
      'Failed to generate explanation'
    );
  });

  it('throws after retry if quiz still fails', async () => {
    const provider = mockProvider(
      explanationResponse('Topic', 'Content...'),
      textOnlyResponse(),
      textOnlyResponse()
    );
    const gen = new ContentGenerator(provider);

    await expect(gen.generateSection(SECTION, 'Course')).rejects.toThrow(
      'Failed to generate quiz'
    );
  });

  it('rejects numeric-input with negative tolerance', async () => {
    const negTolerance = { ...GOOD_NUMERIC, tolerance: -1 };
    const provider = mockProvider(
      explanationResponse('Topic', 'Content...'),
      quizResponse([negTolerance])
    );
    const gen = new ContentGenerator(provider);

    await expect(gen.generateSection(SECTION, 'Course')).rejects.toThrow(
      'failed validation'
    );
  });

  it('throws if all questions fail validation', async () => {
    const provider = mockProvider(
      explanationResponse('Topic', 'Content...'),
      quizResponse([LENGTH_OUTLIER_MCQ, FRONT_MATTER_MCQ])
    );
    const gen = new ContentGenerator(provider);

    await expect(gen.generateSection(SECTION, 'Course')).rejects.toThrow(
      'failed validation'
    );
  });

  it('assigns unique IDs to questions', async () => {
    const provider = mockProvider(
      explanationResponse('Topic', 'Content...'),
      quizResponse([GOOD_MCQ, GOOD_NUMERIC, GOOD_ORDERING])
    );
    const gen = new ContentGenerator(provider);

    const items = await gen.generateSection(SECTION, 'Course');
    const questions = items.filter((i) => i.type !== 'explanation');
    const ids = questions.map((q) => (q as Question).id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toContain('binary-search');
  });
});
