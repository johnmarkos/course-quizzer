import type { StudentModel } from './StudentModel.js';

export class AdaptiveSelector {
  /**
   * Determine the number of questions to generate for a topic based on student mastery.
   *
   * Rules:
   * - Mastery < 0.5: 5 questions (Focus on knowledge gaps)
   * - Mastery > 0.8: 2 questions (Maintain proficiency with minimal overhead)
   * - Otherwise: 3 questions (Default reinforcement)
   */
  static getQuestionCount(studentModel: StudentModel, topicId: string): number {
    const mastery = studentModel.getTopicMastery(topicId);

    if (!mastery) {
      // New topic, treat as gap
      return 5;
    }

    if (mastery.score < 0.5) {
      return 5;
    }

    if (mastery.score > 0.8) {
      return 2;
    }

    return 3;
  }
}
