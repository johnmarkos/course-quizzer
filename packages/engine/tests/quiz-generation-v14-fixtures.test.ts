import { describe, expect, it, vi } from 'vitest';
import { ContentGenerator } from '../src/content/ContentGenerator.js';
import type { ProviderClient, ProviderResponse } from '../src/provider/types.js';
import { RECORDED_V14_QUIZ_CASES } from './fixtures/recorded/quiz-generation-v14.js';

function mockProvider(response: ProviderResponse): ProviderClient {
  return {
    sendMessage: vi.fn().mockResolvedValue(response),
  };
}

function getPracticalFixture() {
  const practicalCase = RECORDED_V14_QUIZ_CASES.find((fixture) =>
    fixture.expectedTypes.includes('code')
  );

  if (!practicalCase) {
    throw new Error('Missing practical v1.4 quiz fixture');
  }

  return practicalCase;
}

describe('quiz generation v1.4 recorded fixtures', () => {
  it.each(RECORDED_V14_QUIZ_CASES)(
    'parses recorded Claude response for $label',
    async (fixture) => {
      const generator = new ContentGenerator(mockProvider(fixture.response));

      const questions = await generator.generateTopicQuizBurst(
        fixture.topic,
        fixture.courseTitle,
        fixture.sectionTitle,
        fixture.explanationContent,
        fixture.expectedTypes.length
      );

      expect(questions).toHaveLength(fixture.expectedTypes.length);
      expect(questions.map((question) => question.type)).toEqual(fixture.expectedTypes);
      expect(questions.map((question) => question.id)).toEqual(
        fixture.expectedTypes.map((_, index) => `${fixture.topic.id}-q${index}`)
      );
      expect(questions.every((question) => question.topicId === fixture.topic.id)).toBe(
        true
      );
    }
  );

  it('covers the practical v1.4 checklist, code, and self-evaluation schema', async () => {
    const fixture = getPracticalFixture();
    const generator = new ContentGenerator(mockProvider(fixture.response));
    const questions = await generator.generateTopicQuizBurst(
      fixture.topic,
      fixture.courseTitle,
      fixture.sectionTitle,
      fixture.explanationContent,
      fixture.expectedTypes.length
    );
    const checklist = questions.find((question) => question.type === 'checklist');
    const code = questions.find((question) => question.type === 'code');
    const selfEvaluation = questions.find(
      (question) => question.type === 'self-evaluation'
    );

    expect(checklist).toMatchObject({
      type: 'checklist',
      items: expect.arrayContaining([
        expect.stringContaining('Identify the input array'),
      ]),
    });
    expect(code).toMatchObject({
      type: 'code',
      language: 'javascript',
      initialCode: expect.stringContaining('function passingScores'),
    });
    expect(selfEvaluation).toMatchObject({
      type: 'self-evaluation',
      options: expect.arrayContaining([expect.stringContaining('independently')]),
    });
  });
});
