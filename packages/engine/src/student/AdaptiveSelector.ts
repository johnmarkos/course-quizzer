import type { StudentModel } from './StudentModel.js';

const GAP_THRESHOLD = 0.5;
const PROFICIENT_THRESHOLD = 0.8;
const GAP_QUESTION_COUNT = 5;
const DEFAULT_QUESTION_COUNT = 3;
const PROFICIENT_QUESTION_COUNT = 2;

export type TopicGenerationConfig = {
  targetQuestionCount: number;
};

export class AdaptiveSelector {
  #studentModel: StudentModel;

  constructor(studentModel: StudentModel) {
    this.#studentModel = studentModel;
  }

  getTopicConfig(topicId: string): TopicGenerationConfig {
    return {
      targetQuestionCount: AdaptiveSelector.getQuestionCount(this.#studentModel, topicId),
    };
  }

  static getQuestionCount(studentModel: StudentModel, topicId: string): number {
    const mastery = studentModel.getTopicMastery(topicId);

    if (!mastery) {
      return DEFAULT_QUESTION_COUNT;
    }

    if (mastery.score < GAP_THRESHOLD) {
      return GAP_QUESTION_COUNT;
    }

    if (mastery.score > PROFICIENT_THRESHOLD) {
      return PROFICIENT_QUESTION_COUNT;
    }

    return DEFAULT_QUESTION_COUNT;
  }
}
