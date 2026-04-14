import { describe, expect, it } from 'vitest';
import { AdaptiveSelector } from '../src/student/AdaptiveSelector.js';
import { StudentModel } from '../src/student/StudentModel.js';

describe('AdaptiveSelector', () => {
  it('returns baseline config for untracked topics', () => {
    const studentModel = new StudentModel();
    const selector = new AdaptiveSelector(studentModel);

    expect(selector.getTopicConfig('unknown-topic')).toEqual({
      targetQuestionCount: 3,
    });
  });

  it('returns more questions for tracked topics with low mastery', () => {
    const studentModel = new StudentModel();
    studentModel.initializeTopic('gap-topic');

    expect(AdaptiveSelector.getQuestionCount(studentModel, 'gap-topic')).toBe(5);
  });

  it('returns fewer questions for highly mastered topics', () => {
    const studentModel = new StudentModel({
      masteryByTopic: {
        topic1: {
          topicId: 'topic1',
          score: 0.9,
          questionsAnswered: 5,
          questionsCorrect: 5,
        },
      },
      gaps: [],
    });

    expect(AdaptiveSelector.getQuestionCount(studentModel, 'topic1')).toBe(2);
  });

  it('returns default question count for in-progress topics', () => {
    const studentModel = new StudentModel({
      masteryByTopic: {
        topic1: {
          topicId: 'topic1',
          score: 0.6,
          questionsAnswered: 2,
          questionsCorrect: 1,
        },
      },
      gaps: [],
    });

    expect(AdaptiveSelector.getQuestionCount(studentModel, 'topic1')).toBe(3);
  });
});
