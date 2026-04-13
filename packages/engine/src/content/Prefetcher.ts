// --- Prefetcher ---
// Handles background content generation for the next section.
// This hides the LLM latency by pre-generating content while the student
// is working on the current section.

import type { ContentGenerator } from './ContentGenerator.js';
import type { ContentCache } from './ContentCache.js';
import type { CurriculumPlan } from '../curriculum/types.js';
import { ContentManager } from './ContentManager.js';

export class Prefetcher {
  #manager: ContentManager;
  #cache: ContentCache;
  #curriculum: CurriculumPlan | null = null;
  #inProgress = new Set<string>();

  constructor(generator: ContentGenerator, cache: ContentCache) {
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
   * Trigger prefetching of the next section.
   * This is a fire-and-forget background operation.
   */
  async prefetch(currentSectionIndex: number): Promise<void> {
    if (!this.#curriculum) return;

    const nextIndex = currentSectionIndex + 1;
    if (nextIndex >= this.#curriculum.sections.length) return;

    const nextSection = this.#curriculum.sections[nextIndex];
    if (this.#cache.has(nextSection.id) || this.#inProgress.has(nextSection.id)) return;

    this.#inProgress.add(nextSection.id);
    try {
      const items = await this.#manager.generateSection(
        nextSection,
        this.#curriculum.title
      );
      this.#cache.set(nextSection.id, items);
    } catch (err) {
      // Errors in the background prefetcher are ignored — the engine
      // will just fall back to its standard generation when the student
      // reaches that section.
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `Prefetch background generation failed for section "${nextSection.id}":`,
        message
      );
    } finally {
      this.#inProgress.delete(nextSection.id);
    }
  }
}
