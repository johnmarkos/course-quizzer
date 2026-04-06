// --- Student Types ---
// Tracks what the student knows and where they're struggling.

export type TopicMastery = {
  topicId: string;
  score: number; // 0.0 to 1.0
  questionsAnswered: number;
  questionsCorrect: number;
};

export type StudentState = {
  masteryByTopic: Record<string, TopicMastery>;
  gaps: string[]; // topic IDs where mastery is below threshold
};

export type SessionProgress = {
  currentSectionIndex: number;
  totalSections: number;
  currentItemIndex: number;
  totalItemsInSection: number;
  overallMastery: number; // 0.0 to 1.0, average across all topics
};
