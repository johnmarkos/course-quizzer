// --- CurriculumManager ---
// Holds the curriculum plan and tracks the student's position.
// Provides navigation: current section, next section, section by ID.
// The CourseEngine uses this to manage the section lifecycle.

import type { CurriculumPlan, Section } from './types.js';

function copySection(section: Section): Section {
  return {
    ...section,
    topics: section.topics.map((topic) => ({ ...topic })),
  };
}

export class CurriculumManager {
  #plan: CurriculumPlan;
  #currentIndex: number = -1;

  constructor(plan: CurriculumPlan) {
    // Defensive copy
    this.#plan = {
      ...plan,
      sections: plan.sections.map(copySection),
    };
  }

  // --- Queries ---

  get plan(): CurriculumPlan {
    return {
      ...this.#plan,
      sections: this.#plan.sections.map(copySection),
    };
  }

  get sections(): Section[] {
    return this.#plan.sections.map(copySection);
  }

  get totalSections(): number {
    return this.#plan.sections.length;
  }

  get currentSectionIndex(): number {
    return this.#currentIndex;
  }

  get currentSection(): Section | null {
    if (this.#currentIndex < 0 || this.#currentIndex >= this.#plan.sections.length) {
      return null;
    }
    const s = this.#plan.sections[this.#currentIndex];
    return copySection(s);
  }

  get hasNextSection(): boolean {
    return this.#currentIndex + 1 < this.#plan.sections.length;
  }

  // --- Navigation ---

  /**
   * Start a section by ID. Returns the section, or throws if not found.
   */
  startSection(sectionId: string): Section {
    const index = this.#plan.sections.findIndex((s) => s.id === sectionId);
    if (index === -1) {
      throw new Error(`Section "${sectionId}" not found in curriculum`);
    }
    this.#currentIndex = index;
    return copySection(this.#plan.sections[index]);
  }

  /**
   * Advance to the next section. Returns the section, or null if
   * the current section is the last one.
   */
  nextSection(): Section | null {
    if (!this.hasNextSection) return null;
    this.#currentIndex++;
    return copySection(this.#plan.sections[this.#currentIndex]);
  }

  /**
   * Get a section by ID without changing the current position.
   */
  getSection(sectionId: string): Section | null {
    const section = this.#plan.sections.find((s) => s.id === sectionId);
    return section ? copySection(section) : null;
  }
}
