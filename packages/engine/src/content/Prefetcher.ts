// --- Prefetcher ---
// Handles background content generation for the next section.
// This hides the LLM latency by pre-generating content while the student
// is working on the current section.

import type { TopicContentGenerator } from './ContentGenerator.js';
import type { ContentCache } from './ContentCache.js';
import type { CurriculumPlan } from '../curriculum/types.js';
import type { StudentModel } from '../student/StudentModel.js';
import { ContentManager } from './ContentManager.js';
import type { ContentItem } from './types.js';

export class Prefetcher {
  #manager: ContentManager;
  #cache: ContentCache;
  #curriculum: CurriculumPlan | null = null;
  #inProgress = new Map<string, Promise<ContentItem[]>>();

  constructor(generator: TopicContentGenerator, cache: ContentCache) {
    this.#manager = new ContentManager(generator, () => {
      // No-op for prefetch background generation (silences UI events)
    });
    this.#cache = cache;
  }

  /**
   * Set the curriculum plan to know what sections can be prefetched.
   */
  setCurriculum(curriculum: CurriculumPlan): void {
    this.#curriculum = curriculum;
  }

  /**
   * Return the active prefetch promise for a section, if one exists.
   * CourseEngine uses this to avoid generating the same section twice when
   * the student reaches a section while its background prefetch is still running.
   */
  getInProgress(sectionId: string): Promise<ContentItem[]> | undefined {
    return this.#inProgress.get(sectionId);
  }

  /**
   * Trigger prefetching of the next section.
   * This is a fire-and-forget background operation.
   */
  async prefetch(currentSectionIndex: number, studentModel: StudentModel): Promise<void> {
    if (!this.#curriculum) return;

    const nextIndex = currentSectionIndex + 1;
    if (nextIndex >= this.#curriculum.sections.length) return;

    const nextSection = this.#curriculum.sections[nextIndex];
    if (this.#cache.has(nextSection.id) || this.#inProgress.has(nextSection.id)) return;

    const generation = this.#manager
      .generateSection(nextSection, this.#curriculum.title, studentModel)
      .then((items) => {
        this.#cache.set(nextSection.id, items);
        return items;
      });
    this.#inProgress.set(nextSection.id, generation);
    try {
      await generation;
    } catch (_err) {
      // Errors in the background prefetcher are ignored — the engine
      // will just fall back to its standard generation when the student
      // reaches that section.
      // We log a generic message to avoid leaking provider-specific error details.
      console.error(
        `Prefetch background generation failed for section "${nextSection.id}": non-critical error during generation`
      );
    } finally {
      if (this.#inProgress.get(nextSection.id) === generation) {
        this.#inProgress.delete(nextSection.id);
      }
    }
  }
}
