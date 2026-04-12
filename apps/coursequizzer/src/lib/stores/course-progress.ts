// --- Course Progress ---
// Extracts progress information from a CourseRecord's snapshot data.
// Pure logic — no Svelte, no browser APIs.

import type { CourseRecord } from '../storage/course-storage.js';
import type { EngineSnapshot, TopicMastery } from 'quizzer-engine';

export type SectionProgress = {
  sectionId: string;
  /** Whether the student has started or completed this section. */
  started: boolean;
  /** Number of topics with at least one answered question. */
  topicsAttempted: number;
  /** Total number of topics in the section. */
  topicsTotal: number;
  /** Average mastery score (0–1) across attempted topics in this section. */
  mastery: number;
};

export type CourseProgressSummary = {
  /** Index of the section the student was last working on (from snapshot). */
  currentSectionIndex: number;
  /** Total number of sections. */
  totalSections: number;
  /** Overall mastery score (0–1) across all attempted topics. */
  overallMastery: number;
  /** Total questions answered across all topics. */
  totalQuestionsAnswered: number;
  /** Per-section progress. */
  sections: SectionProgress[];
  /** Whether the course has been started (snapshot exists with answers). */
  hasProgress: boolean;
};

/**
 * Extract a progress summary from a CourseRecord. Returns null if the course
 * has no snapshot (never started).
 */
export function getCourseProgress(record: CourseRecord): CourseProgressSummary | null {
  const { curriculum, snapshot } = record;
  if (!snapshot) return null;

  const masteryMap = snapshot.studentState?.masteryByTopic ?? {};
  const sections = curriculum.sections;

  const sectionProgress: SectionProgress[] = sections.map((section, index) => {
    const topicIds = section.topics.map((t) => t.id);
    const attempted = topicIds.filter((id) => masteryMap[id]?.questionsAnswered > 0);
    const mastery =
      attempted.length > 0
        ? attempted.reduce((sum, id) => sum + (masteryMap[id]?.score ?? 0), 0) /
          attempted.length
        : 0;

    return {
      sectionId: section.id,
      started: index < snapshot.currentSectionIndex || attempted.length > 0,
      topicsAttempted: attempted.length,
      topicsTotal: topicIds.length,
      mastery,
    };
  });

  const allMasteries = Object.values(masteryMap) as TopicMastery[];
  const attemptedMasteries = allMasteries.filter((m) => m.questionsAnswered > 0);
  const totalAnswered = allMasteries.reduce((sum, m) => sum + m.questionsAnswered, 0);
  const overallMastery =
    attemptedMasteries.length > 0
      ? attemptedMasteries.reduce((sum, m) => sum + m.score, 0) /
        attemptedMasteries.length
      : 0;

  return {
    currentSectionIndex: snapshot.currentSectionIndex,
    totalSections: sections.length,
    overallMastery,
    totalQuestionsAnswered: totalAnswered,
    sections: sectionProgress,
    hasProgress: totalAnswered > 0,
  };
}

/**
 * Format a mastery score (0–1) as a percentage string like "75%".
 */
export function formatMastery(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Get a short human-readable progress label for a course.
 * Examples: "Not started", "Section 2/5 · 75% mastery", "Complete"
 */
export function getProgressLabel(record: CourseRecord): string {
  const progress = getCourseProgress(record);
  if (!progress || !progress.hasProgress) return 'Not started';

  if (
    progress.currentSectionIndex >= progress.totalSections &&
    progress.overallMastery > 0
  ) {
    return `Complete · ${formatMastery(progress.overallMastery)} mastery`;
  }

  const sectionNum = progress.currentSectionIndex + 1;
  return `Section ${sectionNum}/${progress.totalSections} · ${formatMastery(progress.overallMastery)} mastery`;
}
