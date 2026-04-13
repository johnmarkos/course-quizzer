import { describe, it, expect } from 'vitest';
import { AdaptiveSelector } from '../src/student/AdaptiveSelector.js';
import { StudentModel } from '../src/student/StudentModel.js';

describe('AdaptiveSelector', () => {
  it('should return 5 questions for new topics (no mastery)', () => {
    const student = new StudentModel();
    const count = AdaptiveSelector.getQuestionCount(student, 'topic1');
    expect(count).toBe(5);
  });

  it('should return 5 questions for topics with mastery < 0.5', () => {
    const student = new StudentModel({
      masteryByTopic: {
        topic1: {
          topicId: 'topic1',
          score: 0.4,
          questionsAnswered: 1,
          questionsCorrect: 0,
        },
      },
      gaps: ['topic1'],
    });
    const count = AdaptiveSelector.getQuestionCount(student, 'topic1');
    expect(count).toBe(5);
  });

  it('should return 2 questions for topics with mastery > 0.8', () => {
    const student = new StudentModel({
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
    const count = AdaptiveSelector.getQuestionCount(student, 'topic1');
    expect(count).toBe(2);
  });

  it('should return 3 questions for topics with mastery between 0.5 and 0.8', () => {
    const student = new StudentModel({
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
    const count = AdaptiveSelector.getQuestionCount(student, 'topic1');
    expect(count).toBe(3);
  });
});
