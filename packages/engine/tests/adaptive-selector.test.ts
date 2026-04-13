import { describe, it, expect } from 'vitest';
// @ts-ignore - AdaptiveSelector does not exist yet
import { AdaptiveSelector } from '../src/student/AdaptiveSelector.js';
import { StudentModel } from '../src/student/StudentModel.js';

describe.skip('AdaptiveSelector', () => {
  it('recommends more questions for topics with gaps', () => {
    const studentModel = new StudentModel();
    studentModel.initializeTopic('gap-topic');
    studentModel.initializeTopic('mastered-topic');

    // mastered-topic: get above 0.5 threshold
    // 4 correct answers = 0.60
    for (let i = 0; i < 4; i++) {
      studentModel.recordAnswer({ topicId: 'mastered-topic', correct: true });
    }

    // gap-topic: stays at 0 (a gap)

    const selector = new AdaptiveSelector(studentModel);

    const gapConfig = selector.getTopicConfig('gap-topic');
    const masteredConfig = selector.getTopicConfig('mastered-topic');

    expect(gapConfig.targetQuestionCount).toBeGreaterThan(
      masteredConfig.targetQuestionCount
    );
    expect(gapConfig.targetQuestionCount).toBe(5); // Default for gaps
    expect(masteredConfig.targetQuestionCount).toBe(2); // Default for mastered
  });

  it('recommends baseline for unknown topics', () => {
    const studentModel = new StudentModel();
    const selector = new AdaptiveSelector(studentModel);

    const config = selector.getTopicConfig('unknown-topic');
    expect(config.targetQuestionCount).toBe(3); // Baseline
  });

  it('adjusts question difficulty based on mastery', () => {
    // Placeholder for future adaptive logic
    const studentModel = new StudentModel();
    studentModel.initializeTopic('struggling-topic');
    // 0.15 score
    studentModel.recordAnswer({ topicId: 'struggling-topic', correct: true });

    const selector = new AdaptiveSelector(studentModel);
    const config = selector.getTopicConfig('struggling-topic');

    // For now just check it returns a valid config
    expect(config).toHaveProperty('targetQuestionCount');
  });
});
