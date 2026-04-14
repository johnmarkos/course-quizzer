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
import type { Topic } from '../src/curriculum/types.js';
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
    expect(QUIZ_GENERATION_VERSION).toBe('1.2');
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
  it('generates a valid explanation for a topic', async () => {
    const provider = mockProvider(
      explanationResponse('Binary Search', 'Binary search divides...')
    );
    const gen = new ContentGenerator(provider);

    const item = await gen.generateTopicExplanation(TOPIC, 'Algorithms', 'Search');

    expect(item.type).toBe('explanation');
    expect(item.topicId).toBe('binary-search');
    expect(item.content).toBe('Binary search divides...');
  });

  it('generates a valid quiz burst for a topic', async () => {
    const provider = mockProvider(quizResponse([GOOD_MCQ, GOOD_NUMERIC]));
    const gen = new ContentGenerator(provider);

    const questions = await gen.generateTopicQuizBurst(
      TOPIC,
      'Algorithms',
      'Search',
      'Explanation content',
      2
    );

    expect(questions).toHaveLength(2);
    expect(questions[0].type).toBe('multiple-choice');
    expect(questions[1].type).toBe('numeric-input');
    expect(questions[0].topicId).toBe('binary-search');
  });

  it('parses all 5 question types', async () => {
    const provider = mockProvider(
      quizResponse([
        GOOD_MCQ,
        GOOD_NUMERIC,
        GOOD_ORDERING,
        GOOD_MULTI_SELECT,
        GOOD_TWO_STAGE,
      ])
    );
    const gen = new ContentGenerator(provider);

    const questions = await gen.generateTopicQuizBurst(TOPIC, 'C', 'S', 'E', 5);

    expect(questions).toHaveLength(5);
    const types = questions.map((q) => q.type);
    expect(types).toContain('multiple-choice');
    expect(types).toContain('numeric-input');
    expect(types).toContain('ordering');
    expect(types).toContain('multi-select');
    expect(types).toContain('two-stage');
  });

  it('rejects quiz bursts when validation drops below the requested count', async () => {
    const provider = mockProvider(
      quizResponse([GOOD_MCQ, LENGTH_OUTLIER_MCQ, GOOD_NUMERIC])
    );
    const gen = new ContentGenerator(provider);

    await expect(gen.generateTopicQuizBurst(TOPIC, 'C', 'S', 'E', 3)).rejects.toThrow(
      'Expected exactly 3 questions for topic "binary-search", got 2 after validation'
    );
  });

  it('retries explanation on malformed response', async () => {
    const provider = mockProvider(
      textOnlyResponse(), // first attempt fails
      explanationResponse('Binary Search', 'Content...') // retry succeeds
    );
    const gen = new ContentGenerator(provider);

    const item = await gen.generateTopicExplanation(TOPIC, 'C', 'S');

    expect(item.type).toBe('explanation');
    expect((provider.sendMessage as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('retries quiz on malformed response', async () => {
    const provider = mockProvider(
      textOnlyResponse(), // first quiz attempt fails
      quizResponse([GOOD_MCQ]) // retry succeeds
    );
    const gen = new ContentGenerator(provider);

    const questions = await gen.generateTopicQuizBurst(TOPIC, 'C', 'S', 'E', 1);

    expect(questions).toHaveLength(1);
  });

  it('throws after retry if explanation still fails', async () => {
    const provider = mockProvider(textOnlyResponse(), textOnlyResponse());
    const gen = new ContentGenerator(provider);

    await expect(gen.generateTopicExplanation(TOPIC, 'C', 'S')).rejects.toThrow(
      'Failed to generate explanation'
    );
  });

  it('throws after retry if quiz still fails', async () => {
    const provider = mockProvider(textOnlyResponse(), textOnlyResponse());
    const gen = new ContentGenerator(provider);

    await expect(gen.generateTopicQuizBurst(TOPIC, 'C', 'S', 'E')).rejects.toThrow(
      'Failed to generate quiz'
    );
  });

  it('rejects numeric-input with negative tolerance', async () => {
    const negTolerance = { ...GOOD_NUMERIC, tolerance: -1 };
    const provider = mockProvider(quizResponse([negTolerance]));
    const gen = new ContentGenerator(provider);

    await expect(gen.generateTopicQuizBurst(TOPIC, 'C', 'S', 'E', 1)).rejects.toThrow(
      'failed validation'
    );
  });

  it('throws if all questions fail validation', async () => {
    const provider = mockProvider(quizResponse([LENGTH_OUTLIER_MCQ, FRONT_MATTER_MCQ]));
    const gen = new ContentGenerator(provider);

    await expect(gen.generateTopicQuizBurst(TOPIC, 'C', 'S', 'E', 2)).rejects.toThrow(
      'failed validation'
    );
  });

  it('assigns unique IDs to questions', async () => {
    const provider = mockProvider(quizResponse([GOOD_MCQ, GOOD_NUMERIC, GOOD_ORDERING]));
    const gen = new ContentGenerator(provider);

    const questions = await gen.generateTopicQuizBurst(TOPIC, 'C', 'S', 'E');
    const ids = questions.map((q) => (q as Question).id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toContain('binary-search');
  });

  it('uses the requested question count when building the quiz prompt', async () => {
    const provider = mockProvider(quizResponse([GOOD_MCQ, GOOD_NUMERIC]));
    const gen = new ContentGenerator(provider);

    await gen.generateTopicQuizBurst(TOPIC, 'Algorithms', 'Search', 'Content...', 2);

    const quizCall = (provider.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(quizCall.messages[0].content).toContain('Generate exactly 2 quiz questions');
    const tool = quizCall.tools[0];
    expect(tool.inputSchema.properties.questions.minItems).toBe(2);
    expect(tool.inputSchema.properties.questions.maxItems).toBe(2);
  });

  it('rejects quiz bursts that do not return the requested question count', async () => {
    const provider = mockProvider(quizResponse([GOOD_MCQ, GOOD_NUMERIC, GOOD_ORDERING]));
    const gen = new ContentGenerator(provider);

    await expect(
      gen.generateTopicQuizBurst(TOPIC, 'Algorithms', 'Search', 'Content...', 2)
    ).rejects.toThrow('Expected exactly 2 questions for topic "binary-search", got 3');
  });
});
