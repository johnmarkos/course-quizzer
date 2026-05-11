import { describe, expect, it, vi } from 'vitest';
import { ContentManager } from '../src/content/ContentManager.js';
import type { ContentGenerator } from '../src/content/ContentGenerator.js';
import type { Section, Topic } from '../src/curriculum/types.js';
import { AdaptiveSelector } from '../src/student/AdaptiveSelector.js';
import { StudentModel } from '../src/student/StudentModel.js';
import type { TopicMastery } from '../src/student/types.js';

function createStudentModel(scoresByTopic: Record<string, number>): StudentModel {
  const masteryByTopic: Record<string, TopicMastery> = {};
  const gaps: string[] = [];

  for (const [topicId, score] of Object.entries(scoresByTopic)) {
    masteryByTopic[topicId] = {
      topicId,
      score,
      questionsAnswered: 100,
      questionsCorrect: Math.round(score * 100),
    };

    if (score < 0.5) {
      gaps.push(topicId);
    }
  }

  return new StudentModel({ masteryByTopic, gaps });
}

describe('AdaptiveSelector', () => {
  it('returns baseline config for untracked topics', () => {
    const studentModel = new StudentModel();
    const selector = new AdaptiveSelector(studentModel);

    expect(selector.getTopicConfig('unknown-topic')).toEqual({
      targetQuestionCount: 3,
    });
  });

  it.each([
    { label: 'zero mastery', score: 0, expectedQuestionCount: 5 },
    { label: 'just below gap threshold', score: 0.49, expectedQuestionCount: 5 },
    { label: 'at gap threshold', score: 0.5, expectedQuestionCount: 3 },
    { label: 'just below proficient threshold', score: 0.79, expectedQuestionCount: 3 },
    { label: 'at proficient threshold', score: 0.8, expectedQuestionCount: 3 },
    { label: 'full mastery', score: 1, expectedQuestionCount: 2 },
  ])(
    'returns $expectedQuestionCount questions for $label',
    ({ score, expectedQuestionCount }) => {
      const studentModel = createStudentModel({ topic1: score });

      expect(AdaptiveSelector.getQuestionCount(studentModel, 'topic1')).toBe(
        expectedQuestionCount
      );
    }
  );

  it.each([
    { band: 'gap', score: 0.25, expectedQuestionCount: 5 },
    { band: 'default', score: 0.65, expectedQuestionCount: 3 },
    { band: 'proficient', score: 0.95, expectedQuestionCount: 2 },
  ])(
    'returns the configured $band question count',
    ({ score, expectedQuestionCount }) => {
      const studentModel = createStudentModel({ topic1: score });

      expect(AdaptiveSelector.getQuestionCount(studentModel, 'topic1')).toBe(
        expectedQuestionCount
      );
    }
  );

  it('returns the correct config for each topic in a mixed-mastery section', () => {
    const section: Section = {
      id: 'section-1',
      title: 'Mixed Mastery',
      order: 0,
      topics: [
        { id: 'gap-topic', title: 'Gap Topic', description: 'Needs practice' },
        { id: 'default-topic', title: 'Default Topic', description: 'In progress' },
        {
          id: 'proficient-topic',
          title: 'Proficient Topic',
          description: 'Mostly mastered',
        },
      ],
    };
    const studentModel = createStudentModel({
      'gap-topic': 0.49,
      'default-topic': 0.5,
      'proficient-topic': 0.95,
    });
    const selector = new AdaptiveSelector(studentModel);

    const countsByTopic = Object.fromEntries(
      section.topics.map((topic) => [
        topic.id,
        selector.getTopicConfig(topic.id).targetQuestionCount,
      ])
    );

    expect(countsByTopic).toEqual({
      'gap-topic': 5,
      'default-topic': 3,
      'proficient-topic': 2,
    });
  });

  it('passes adaptive counts through ContentManager for a whole section', async () => {
    const section: Section = {
      id: 'section-1',
      title: 'Adaptive Section',
      order: 0,
      topics: [
        { id: 'gap-topic', title: 'Gap Topic', description: 'Needs practice' },
        { id: 'default-topic', title: 'Default Topic', description: 'In progress' },
        {
          id: 'proficient-topic',
          title: 'Proficient Topic',
          description: 'Mostly mastered',
        },
      ],
    };
    const studentModel = createStudentModel({
      'gap-topic': 0.49,
      'default-topic': 0.79,
      'proficient-topic': 0.95,
    });
    const generateTopicExplanation = vi.fn(async (topic: Topic) => ({
      type: 'explanation' as const,
      topicId: topic.id,
      title: `${topic.title} explanation`,
      content: `Content for ${topic.id}`,
    }));
    const generateTopicQuizBurst = vi.fn(async () => []);
    const generator = {
      generateTopicExplanation,
      generateTopicQuizBurst,
    } as unknown as ContentGenerator;

    const manager = new ContentManager(generator, () => {});
    await manager.generateSection(section, 'Course', studentModel);

    expect(generateTopicQuizBurst).toHaveBeenNthCalledWith(
      1,
      section.topics[0],
      'Course',
      'Adaptive Section',
      'Content for gap-topic',
      5
    );
    expect(generateTopicQuizBurst).toHaveBeenNthCalledWith(
      2,
      section.topics[1],
      'Course',
      'Adaptive Section',
      'Content for default-topic',
      3
    );
    expect(generateTopicQuizBurst).toHaveBeenNthCalledWith(
      3,
      section.topics[2],
      'Course',
      'Adaptive Section',
      'Content for proficient-topic',
      2
    );
  });
});
