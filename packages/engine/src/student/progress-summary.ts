import type { CurriculumPlan } from '../curriculum/types.js';
import type { EngineSnapshot } from '../engine/types.js';
import { StudentModel } from './StudentModel.js';
import type { CourseProgressSummary } from './types.js';

/**
 * Build a course overview progress summary from a persisted engine snapshot.
 * Consumers pass untrusted imports through snapshot validation before storing them;
 * this helper centralizes all mastery and gap-derived calculations in the engine.
 */
export function summarizeCourseProgress(
  curriculum: CurriculumPlan,
  snapshot: EngineSnapshot | null
): CourseProgressSummary | null {
  if (!snapshot) return null;

  const studentModel = new StudentModel(snapshot.studentState);
  return studentModel.computeCourseProgress({
    currentSectionIndex: snapshot.currentSectionIndex,
    sections: curriculum.sections,
  });
}
