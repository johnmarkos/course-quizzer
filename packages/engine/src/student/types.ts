// --- Student Types ---
// Tracks what the student knows and where they're struggling.

export type TopicMastery = {
  topicId: string;
  score: number; // 0.0 to 1.0
  questionsAnswered: number;
  questionsCorrect: number;
};

export type MasteryStatus = 'struggling' | 'gaining' | 'mastered';

export type TopicProgress = {
  topicId: string;
  title: string;
  score: number; // 0.0 to 1.0
  questionsAnswered: number;
  questionsCorrect: number;
  status: MasteryStatus;
  needsReview: boolean;
};

export type SectionProgressSummary = {
  sectionId: string;
  title: string;
  started: boolean;
  topicsAttempted: number;
  topicsTotal: number;
  mastery: number; // 0.0 to 1.0, average across attempted topics
  topics: TopicProgress[];
};

export type CourseProgressSummary = {
  currentSectionIndex: number;
  totalSections: number;
  overallMastery: number; // 0.0 to 1.0, average across attempted topics
  totalQuestionsAnswered: number;
  sections: SectionProgressSummary[];
  hasProgress: boolean;
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
  currentSection: SectionProgressSummary | null;
};
