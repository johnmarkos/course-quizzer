// --- Student Types ---
// Tracks what the student knows and where they're struggling.

export type TopicMastery = {
  topicId: string;
  score: number; // 0.0 to 1.0
  questionsAnswered: number;
  questionsCorrect: number;
};

export type TopicMasteryLevel = 'struggling' | 'gaining' | 'mastered';

export type TopicProgressSummary = {
  topicId: string;
  score: number; // 0.0 to 1.0
  scorePercent: number;
  questionsAnswered: number;
  questionsCorrect: number;
  level: TopicMasteryLevel;
  needsReview: boolean;
};

export type StudentState = {
  masteryByTopic: Record<string, TopicMastery>;
  gaps: string[]; // topic IDs where mastery is below threshold
};

export type ProgressTopicInput = {
  id: string;
};

export type ProgressSectionInput = {
  id: string;
  topics: ProgressTopicInput[];
};

export type SectionProgressSummary = {
  sectionId: string;
  /** Whether the student has started or completed this section. */
  started: boolean;
  /** Number of topics with at least one answered question. */
  topicsAttempted: number;
  /** Total number of topics in the section. */
  topicsTotal: number;
  /** Average mastery score (0-1) across attempted topics in this section. */
  mastery: number;
  masteryPercent: number;
};

export type CourseProgressSummary = {
  /** Index of the section the student was last working on. */
  currentSectionIndex: number;
  /** Total number of sections. */
  totalSections: number;
  /** Overall mastery score (0-1) across all attempted topics. */
  overallMastery: number;
  overallMasteryPercent: number;
  /** Total questions answered across all topics. */
  totalQuestionsAnswered: number;
  /** Per-section progress. */
  sections: SectionProgressSummary[];
  /** Whether the course has any answered questions. */
  hasProgress: boolean;
};

export type SessionProgress = {
  currentSectionIndex: number;
  totalSections: number;
  currentItemIndex: number;
  totalItemsInSection: number;
  overallMastery: number; // 0.0 to 1.0, average across all topics
  overallMasteryPercent: number;
  totalQuestionsAnswered: number;
  sections: SectionProgressSummary[];
  currentSectionTopicProgress: TopicProgressSummary[];
  hasProgress: boolean;
};
