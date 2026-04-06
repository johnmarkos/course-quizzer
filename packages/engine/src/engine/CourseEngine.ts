// --- CourseEngine ---
// Central orchestrator for adaptive course content generation.
// Manages the lifecycle from syllabus input through content generation
// and student interaction. Emits events for all state changes —
// the UI consumes these events and never reaches back into the engine.

import { EventEmitter } from './events.js';
import { InvalidTransitionError } from './errors.js';
import type {
  CourseEngineConfig,
  EngineSnapshot,
  EngineState,
  CurriculumPlan,
  ContentItem,
  AnswerResult,
  StudentState,
  SessionProgress,
} from './types.js';
import type { StudentAnswer, Question } from '../content/types.js';
import type { Section } from '../curriculum/types.js';

const SNAPSHOT_VERSION = 2;
const GAP_THRESHOLD = 0.5; // topics below this mastery score are "gaps"

export class CourseEngine extends EventEmitter {
  #state: EngineState = 'idle';
  #config: CourseEngineConfig;
  #curriculum: CurriculumPlan | null = null;
  #currentSectionIndex = -1;
  #currentItemIndex = -1;
  #sectionItems: ContentItem[] = [];
  #studentState: StudentState = { masteryByTopic: {}, gaps: [] };
  #lastAnswerResult: AnswerResult | null = null;

  constructor(config: CourseEngineConfig) {
    super();
    this.#config = { ...config };
  }

  // --- State ---

  get state(): EngineState {
    return this.#state;
  }

  get curriculum(): CurriculumPlan | null {
    return this.#curriculum;
  }

  get currentSection(): Section | null {
    if (!this.#curriculum || this.#currentSectionIndex < 0) return null;
    return this.#curriculum.sections[this.#currentSectionIndex] ?? null;
  }

  get currentItem(): ContentItem | null {
    if (this.#currentItemIndex < 0) return null;
    return this.#sectionItems[this.#currentItemIndex] ?? null;
  }

  get studentState(): StudentState {
    // Return a defensive copy so callers can't mutate internal state
    return {
      masteryByTopic: { ...this.#studentState.masteryByTopic },
      gaps: [...this.#studentState.gaps],
    };
  }

  get sessionProgress(): SessionProgress {
    const totalSections = this.#curriculum?.sections.length ?? 0;
    const masteries = Object.values(this.#studentState.masteryByTopic);
    const overallMastery =
      masteries.length > 0
        ? masteries.reduce((sum, m) => sum + m.score, 0) / masteries.length
        : 0;

    return {
      currentSectionIndex: this.#currentSectionIndex,
      totalSections,
      currentItemIndex: this.#currentItemIndex,
      totalItemsInSection: this.#sectionItems.length,
      overallMastery,
    };
  }

  // --- State Transitions ---

  #setState(newState: EngineState): void {
    const from = this.#state;
    this.#state = newState;
    this.emit('stateChange', { from, to: newState });
  }

  #requireState(action: string, ...validStates: EngineState[]): void {
    if (!validStates.includes(this.#state)) {
      throw new InvalidTransitionError(action, this.#state);
    }
  }

  // --- Syllabus Loading ---
  // In the full implementation, this calls the LLM to analyze the syllabus.
  // For now, it accepts a pre-built CurriculumPlan directly.

  loadCurriculum(curriculum: CurriculumPlan): void {
    this.#requireState('loadCurriculum', 'idle');

    this.#curriculum = {
      ...curriculum,
      sections: curriculum.sections.map((s) => ({
        ...s,
        topics: [...s.topics],
      })),
    };

    // Initialize mastery for all topics
    for (const section of this.#curriculum.sections) {
      for (const topic of section.topics) {
        this.#studentState.masteryByTopic[topic.id] = {
          topicId: topic.id,
          score: 0,
          questionsAnswered: 0,
          questionsCorrect: 0,
        };
      }
    }

    this.#setState('ready');
    this.emit('syllabusLoaded', { curriculum: this.#curriculum });
  }

  // --- Section Lifecycle ---

  startSection(sectionId: string): void {
    this.#requireState('startSection', 'ready', 'sectionComplete');

    if (!this.#curriculum) {
      throw new InvalidTransitionError('startSection', 'no curriculum loaded');
    }

    const sectionIndex = this.#curriculum.sections.findIndex((s) => s.id === sectionId);
    if (sectionIndex === -1) {
      throw new InvalidTransitionError(
        'startSection',
        `section "${sectionId}" not found`
      );
    }

    this.#currentSectionIndex = sectionIndex;
    this.#currentItemIndex = -1;
    this.#sectionItems = [];
    this.#lastAnswerResult = null;

    const section = this.#curriculum.sections[sectionIndex];
    this.#setState('loading');
    this.emit('sectionStart', {
      section,
      sectionIndex,
      totalSections: this.#curriculum.sections.length,
    });
  }

  // --- Content Loading ---
  // Called by the content generator after it produces items for the section.
  // This is the bridge between the async LLM call and the engine state machine.

  setSectionContent(items: ContentItem[]): void {
    this.#requireState('setSectionContent', 'loading');

    this.#sectionItems = items.map((item) => ({ ...item }));
    this.#currentItemIndex = 0;

    const section = this.currentSection!;
    this.emit('contentReady', { items: this.#sectionItems, section });

    this.#setState('practicing');
    this.#emitCurrentItem();
  }

  // --- Student Interaction ---

  submitAnswer(answer: StudentAnswer): AnswerResult {
    this.#requireState('submitAnswer', 'practicing');

    const item = this.currentItem;
    if (!item || item.type === 'explanation') {
      throw new InvalidTransitionError('submitAnswer', 'current item is not a question');
    }

    const result = this.#gradeAnswer(item, answer);
    this.#lastAnswerResult = result;

    // Update mastery
    this.#updateMastery(result);

    this.#setState('answered');
    this.emit('answerResult', {
      result,
      studentState: this.studentState,
      progress: this.sessionProgress,
    });

    return result;
  }

  nextItem(): void {
    this.#requireState('nextItem', 'answered', 'practicing');

    // In 'practicing' state, nextItem is only valid if current item is an explanation
    if (this.#state === 'practicing') {
      const item = this.currentItem;
      if (item && item.type !== 'explanation') {
        throw new InvalidTransitionError(
          'nextItem',
          'must answer the current question before advancing'
        );
      }
    }

    this.#currentItemIndex++;
    this.#lastAnswerResult = null;

    // Check if section is complete
    if (this.#currentItemIndex >= this.#sectionItems.length) {
      this.#completeSection();
      return;
    }

    this.#setState('practicing');
    this.#emitCurrentItem();
  }

  skipQuestion(): void {
    this.#requireState('skipQuestion', 'practicing');

    const item = this.currentItem;
    if (!item || item.type === 'explanation') {
      throw new InvalidTransitionError('skipQuestion', 'current item is not a question');
    }

    this.#currentItemIndex++;
    this.#lastAnswerResult = null;

    if (this.#currentItemIndex >= this.#sectionItems.length) {
      this.#completeSection();
      return;
    }

    // Stay in practicing, show next item
    this.#emitCurrentItem();
  }

  nextSection(): void {
    this.#requireState('nextSection', 'sectionComplete');

    if (!this.#curriculum) {
      throw new InvalidTransitionError('nextSection', 'no curriculum loaded');
    }

    const nextIndex = this.#currentSectionIndex + 1;
    if (nextIndex >= this.#curriculum.sections.length) {
      // Course is complete
      this.#setState('complete');
      this.emit('courseComplete', {
        studentState: this.studentState,
        progress: this.sessionProgress,
      });
      return;
    }

    const nextSection = this.#curriculum.sections[nextIndex];
    this.startSection(nextSection.id);
  }

  // --- Internal Helpers ---

  #emitCurrentItem(): void {
    const item = this.currentItem;
    if (!item) return;

    this.emit('itemShow', {
      item,
      itemIndex: this.#currentItemIndex,
      totalItems: this.#sectionItems.length,
    });
  }

  #completeSection(): void {
    const section = this.currentSection!;
    this.#setState('sectionComplete');
    this.emit('sectionComplete', {
      section,
      studentState: this.studentState,
      progress: this.sessionProgress,
    });
  }

  #updateMastery(result: AnswerResult): void {
    const topicId = result.topicId;
    const mastery = this.#studentState.masteryByTopic[topicId];
    if (!mastery) return;

    mastery.questionsAnswered++;
    if (result.correct) {
      mastery.questionsCorrect++;
      mastery.score = Math.min(1, mastery.score + 0.15);
    } else {
      mastery.score = Math.max(0, mastery.score - 0.1);
    }

    // Update gaps list
    this.#studentState.gaps = Object.values(this.#studentState.masteryByTopic)
      .filter((m) => m.score < GAP_THRESHOLD)
      .map((m) => m.topicId);
  }

  // --- Grading ---

  #gradeAnswer(question: Question, answer: StudentAnswer): AnswerResult {
    if (question.type !== answer.type) {
      return {
        correct: false,
        questionId: question.id,
        topicId: question.topicId,
        userAnswer: answer,
        correctAnswer: this.#describeCorrectAnswer(question),
        explanation: 'Answer type does not match question type.',
      };
    }

    const correct = this.#checkCorrectness(question, answer);

    return {
      correct,
      questionId: question.id,
      topicId: question.topicId,
      userAnswer: answer,
      correctAnswer: this.#describeCorrectAnswer(question),
    };
  }

  #checkCorrectness(question: Question, answer: StudentAnswer): boolean {
    switch (question.type) {
      case 'multiple-choice': {
        const a = answer as { type: 'multiple-choice'; selectedIndex: number };
        return a.selectedIndex === question.correctIndex;
      }
      case 'numeric-input': {
        const a = answer as { type: 'numeric-input'; value: number };
        const tolerance = question.tolerance ?? 0;
        // Guard against division by zero when correctValue is 0
        if (question.correctValue === 0) {
          return Math.abs(a.value) <= tolerance;
        }
        return Math.abs(a.value - question.correctValue) <= tolerance;
      }
      case 'ordering': {
        const a = answer as { type: 'ordering'; order: number[] };
        return (
          a.order.length === question.correctOrder.length &&
          a.order.every((val, idx) => val === question.correctOrder[idx])
        );
      }
      case 'multi-select': {
        const a = answer as { type: 'multi-select'; selectedIndices: number[] };
        const correct = [...question.correctIndices].sort();
        const selected = [...a.selectedIndices].sort();
        return (
          correct.length === selected.length &&
          correct.every((val, idx) => val === selected[idx])
        );
      }
      case 'two-stage': {
        const a = answer as {
          type: 'two-stage';
          selectedIndex: number;
          followUpSelectedIndex: number;
        };
        return (
          a.selectedIndex === question.correctIndex &&
          a.followUpSelectedIndex === question.followUpCorrectIndex
        );
      }
    }
  }

  #describeCorrectAnswer(question: Question): string {
    switch (question.type) {
      case 'multiple-choice':
        return question.options[question.correctIndex];
      case 'numeric-input': {
        const unit = question.unit ? ` ${question.unit}` : '';
        return `${question.correctValue}${unit}`;
      }
      case 'ordering':
        return question.correctOrder.map((i) => question.items[i]).join(' → ');
      case 'multi-select':
        return question.correctIndices.map((i) => question.options[i]).join(', ');
      case 'two-stage':
        return `${question.options[question.correctIndex]}, then ${question.followUpOptions[question.followUpCorrectIndex]}`;
    }
  }

  // --- Persistence ---

  serialize(): EngineSnapshot {
    return {
      version: SNAPSHOT_VERSION,
      state: this.#state,
      curriculum: this.#curriculum,
      currentSectionIndex: this.#currentSectionIndex,
      currentItemIndex: this.#currentItemIndex,
      sectionItems: this.#sectionItems,
      studentState: this.#studentState,
      lastAnswerResult: this.#lastAnswerResult,
    };
  }

  static restore(snapshot: EngineSnapshot, config: CourseEngineConfig): CourseEngine {
    if (snapshot.version !== SNAPSHOT_VERSION) {
      throw new Error(
        `Unsupported snapshot version: ${snapshot.version} (expected ${SNAPSHOT_VERSION})`
      );
    }

    // Constructor does not emit events for idle state.
    // We overwrite all state from the snapshot.
    // Restore does NOT emit events — the consumer must resync explicitly.
    const engine = new CourseEngine(config);
    engine.#state = snapshot.state;
    engine.#curriculum = snapshot.curriculum;
    engine.#currentSectionIndex = snapshot.currentSectionIndex;
    engine.#currentItemIndex = snapshot.currentItemIndex;
    engine.#sectionItems = snapshot.sectionItems;
    engine.#studentState = snapshot.studentState;
    engine.#lastAnswerResult = snapshot.lastAnswerResult;
    return engine;
  }
}
