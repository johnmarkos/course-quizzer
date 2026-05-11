// --- Course Progress ---
// Extracts progress information from a CourseRecord's snapshot data.
// Pure logic — no Svelte, no browser APIs.

import type { CourseRecord } from '../storage/course-storage.js';
import { summarizeCourseProgress, type CourseProgressSummary } from 'quizzer-engine';

export type { CourseProgressSummary, SectionProgressSummary } from 'quizzer-engine';

/**
 * Extract a progress summary from a CourseRecord. Returns null if the course
 * has no snapshot (never started).
 */
export function getCourseProgress(record: CourseRecord): CourseProgressSummary | null {
  if (!record.snapshot) return null;

  return summarizeCourseProgress(record.curriculum, {
    currentSectionIndex: record.snapshot.currentSectionIndex,
    studentState: record.snapshot.studentState,
  });
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
