// --- StudentModel ---
// Tracks per-topic mastery and identifies knowledge gaps.
// The engine delegates all mastery tracking to this class.
// It owns the StudentState and provides SessionProgress computation.
//
// Mastery update rules:
//   - Correct answer: score += BASE_GAIN (0.15), clamped to [0, 1]
//   - Incorrect answer: score -= BASE_LOSS (0.10), clamped to [0, 1]
//   - Topics with score < GAP_THRESHOLD (0.5) are tracked as gaps
//
// The model is serializable: getState() returns a snapshot,
// and the constructor can restore from a prior StudentState.

import type { StudentState, TopicMastery, SessionProgress } from './types.js';

const GAP_THRESHOLD = 0.5;
const BASE_GAIN = 0.15;
const BASE_LOSS = 0.1;

export type MasteryUpdate = {
  topicId: string;
  correct: boolean;
};

export class StudentModel {
  #masteryByTopic: Map<string, TopicMastery>;
  #gaps: Set<string>;

  constructor(state?: StudentState) {
    if (state) {
      this.#masteryByTopic = new Map(
        Object.entries(state.masteryByTopic).map(([id, mastery]) => [id, { ...mastery }])
      );
      this.#gaps = new Set(state.gaps);
    } else {
      this.#masteryByTopic = new Map();
      this.#gaps = new Set();
    }
  }

  // --- Topic Initialization ---

  /**
   * Register a topic for tracking. Sets initial mastery to 0.
   * Skips topics that are already registered (e.g., from a restored state).
   */
  initializeTopic(topicId: string): void {
    if (this.#masteryByTopic.has(topicId)) return;

    this.#masteryByTopic.set(topicId, {
      topicId,
      score: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
    });
    // New topics start at 0, which is below the gap threshold
    this.#gaps.add(topicId);
  }

  // --- Mastery Updates ---

  /**
   * Record an answer result and update the topic's mastery score.
   * Returns the updated TopicMastery for the topic.
   */
  recordAnswer(update: MasteryUpdate): TopicMastery {
    const mastery = this.#masteryByTopic.get(update.topicId);
    if (!mastery) {
      throw new Error(`Topic "${update.topicId}" is not tracked by the student model`);
    }

    mastery.questionsAnswered++;

    if (update.correct) {
      mastery.questionsCorrect++;
      mastery.score = Math.min(1, mastery.score + BASE_GAIN);
    } else {
      mastery.score = Math.max(0, mastery.score - BASE_LOSS);
    }

    // Update gaps
    if (mastery.score < GAP_THRESHOLD) {
      this.#gaps.add(update.topicId);
    } else {
      this.#gaps.delete(update.topicId);
    }

    return { ...mastery };
  }

  // --- Queries ---

  /** Get mastery for a specific topic, or undefined if not tracked. */
  getTopicMastery(topicId: string): TopicMastery | undefined {
    const mastery = this.#masteryByTopic.get(topicId);
    return mastery ? { ...mastery } : undefined;
  }

  /** Topic IDs where mastery is below the gap threshold. */
  get gaps(): string[] {
    return [...this.#gaps];
  }

  /** Average mastery across all tracked topics. 0 if no topics. */
  get overallMastery(): number {
    if (this.#masteryByTopic.size === 0) return 0;

    let total = 0;
    for (const mastery of this.#masteryByTopic.values()) {
      total += mastery.score;
    }
    return total / this.#masteryByTopic.size;
  }

  /** Number of topics currently tracked. */
  get topicCount(): number {
    return this.#masteryByTopic.size;
  }

  // --- Session Progress ---

  /**
   * Compute session progress given the current section/item position.
   * The StudentModel owns the mastery calculation; the engine provides
   * the positional data (section index, item index, totals).
   */
  computeProgress(position: {
    currentSectionIndex: number;
    totalSections: number;
    currentItemIndex: number;
    totalItemsInSection: number;
  }): SessionProgress {
    return {
      currentSectionIndex: position.currentSectionIndex,
      totalSections: position.totalSections,
      currentItemIndex: position.currentItemIndex,
      totalItemsInSection: position.totalItemsInSection,
      overallMastery: this.overallMastery,
    };
  }

  // --- Serialization ---

  /** Returns a snapshot of the current student state. */
  getState(): StudentState {
    const masteryByTopic: Record<string, TopicMastery> = {};
    for (const [id, mastery] of this.#masteryByTopic) {
      masteryByTopic[id] = { ...mastery };
    }
    return {
      masteryByTopic,
      gaps: [...this.#gaps],
    };
  }
}
