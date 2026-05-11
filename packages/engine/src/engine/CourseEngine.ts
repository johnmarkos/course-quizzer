// --- CourseEngine ---
// Central orchestrator for adaptive course content generation.
// Manages the lifecycle from syllabus input through content generation
// and student interaction. Emits events for all state changes —
// the UI consumes these events and never reaches back into the engine.

import { EventEmitter } from './events.js';
import { InvalidTransitionError } from './errors.js';
import { SNAPSHOT_VERSION } from './constants.js';
import { StudentModel } from '../student/StudentModel.js';
import { createDefaultProvider } from '../provider/factory.js';
import { ContentGenerator } from '../content/ContentGenerator.js';
import { ContentManager } from '../content/ContentManager.js';
import { ContentCache } from '../content/ContentCache.js';
import { copyContentItem } from '../content/copy-utils.js';
import { Prefetcher } from '../content/Prefetcher.js';
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

function copySection(section: Section): Section {
  // ... (omitting for brevity in this thought but I'll provide full in the call)

  return {
    ...section,
    topics: section.topics.map((topic) => ({ ...topic })),
  };
}

function copyCurriculumPlan(curriculum: CurriculumPlan): CurriculumPlan {
  return {
    ...curriculum,
    sections: curriculum.sections.map(copySection),
  };
}

function copyStudentAnswer(answer: StudentAnswer): StudentAnswer {
  switch (answer.type) {
    case 'multiple-choice':
      return { ...answer };
    case 'numeric-input':
      return { ...answer };
    case 'ordering':
      return { ...answer, order: [...answer.order] };
    case 'multi-select':
      return { ...answer, selectedIndices: [...answer.selectedIndices] };
    case 'two-stage':
      return { ...answer };
    case 'checklist':
      return { ...answer, checkedIndices: [...answer.checkedIndices] };
    case 'code':
      return { ...answer };
    case 'self-evaluation':
      return { ...answer };
  }
}

function copyAnswerResult(result: AnswerResult): AnswerResult {
  return {
    ...result,
    userAnswer: copyStudentAnswer(result.userAnswer),
  };
}

function isValidGeneratedContentRecord(
  value: unknown
): value is Record<string, ContentItem[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (items) =>
      Array.isArray(items) &&
      items.every((item) => {
        try {
          return copyContentItem(item as ContentItem) !== undefined;
        } catch {
          return false;
        }
      })
  );
}

export class CourseEngine extends EventEmitter {
  #state: EngineState = 'idle';
  #config: CourseEngineConfig;
  #curriculum: CurriculumPlan | null = null;
  #currentSectionIndex = -1;
  #currentItemIndex = -1;
  #sectionItems: ContentItem[] = [];
  #allGeneratedContent: Record<string, ContentItem[]> = {};
  #studentModel: StudentModel = new StudentModel();
  #lastAnswerResult: AnswerResult | null = null;
  #contentManager: ContentManager;
  #contentCache: ContentCache | null = null;
  #prefetcher: Prefetcher | null = null;

  constructor(config: CourseEngineConfig) {
    super();
    this.#config = { ...config };

    const provider =
      config.provider ||
      createDefaultProvider({
        apiKey: config.apiKey,
        model: config.model,
      });

    const generator = config.generator || new ContentGenerator(provider);

    this.#contentManager = new ContentManager(generator, (payload) => {
      if (payload.status === 'start') {
        this.emit('apiCallStart', { id: payload.id, purpose: payload.purpose });
      } else {
        this.emit('apiCallComplete', { id: payload.id, purpose: payload.purpose });
      }
    });

    if (config.prefetch?.enabled) {
      this.#contentCache = new ContentCache();
      this.#prefetcher = new Prefetcher(
        config.prefetch.generator ?? generator,
        this.#contentCache
      );
    }
  }

  // --- State ---

  get state(): EngineState {
    return this.#state;
  }

  get curriculum(): CurriculumPlan | null {
    if (!this.#curriculum) return null;
    return copyCurriculumPlan(this.#curriculum);
  }

  get currentSection(): Section | null {
    if (!this.#curriculum || this.#currentSectionIndex < 0) return null;
    const s = this.#curriculum.sections[this.#currentSectionIndex];
    if (!s) return null;
    return copySection(s);
  }

  get currentItem(): ContentItem | null {
    if (this.#currentItemIndex < 0) return null;
    const item = this.#sectionItems[this.#currentItemIndex];
    if (!item) return null;
    return copyContentItem(item);
  }

  get studentState(): StudentState {
    return this.#studentModel.getState();
  }

  get sessionProgress(): SessionProgress {
    return this.#studentModel.computeProgress({
      currentSectionIndex: this.#currentSectionIndex,
      totalSections: this.#curriculum?.sections.length ?? 0,
      currentItemIndex: this.#currentItemIndex,
      totalItemsInSection: this.#sectionItems.length,
      sections: this.#curriculum?.sections ?? [],
    });
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

    this.#curriculum = copyCurriculumPlan(curriculum);

    if (this.#prefetcher) {
      this.#prefetcher.setCurriculum(this.#curriculum);
    }

    // Initialize mastery for all topics
    for (const section of this.#curriculum.sections) {
      for (const topic of section.topics) {
        this.#studentModel.initializeTopic(topic.id);
      }
    }

    this.#setState('ready');
    this.emit('syllabusLoaded', { curriculum: copyCurriculumPlan(this.#curriculum) });
  }

  // --- Section Lifecycle ---

  startSection(sectionId: string): void {
    this.#requireState('startSection', 'ready', 'sectionComplete', 'error');

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

    const section = copySection(this.#curriculum.sections[sectionIndex]);
    const courseTitle = this.#curriculum.title;
    this.#setState('loading');
    this.emit('sectionStart', {
      section,
      sectionIndex,
      totalSections: this.#curriculum.sections.length,
    });

    // Check if content is already cached
    if (this.#contentCache?.has(sectionId)) {
      const cachedItems = this.#contentCache.get(sectionId)!;
      this.setSectionContent(cachedItems);
      return;
    }

    const inProgressPrefetch = this.#prefetcher?.getInProgress(sectionId);
    if (inProgressPrefetch) {
      inProgressPrefetch
        .then((items) => {
          this.setSectionContent(items);
        })
        .catch(() => {
          // The background attempt failed; retry as foreground generation so
          // the existing prefetch failure fallback still applies.
          this.#generateSectionContent(section, courseTitle);
        });
      return;
    }

    this.#generateSectionContent(section, courseTitle);
  }

  #generateSectionContent(section: Section, courseTitle: string): void {
    this.#contentManager
      .generateSection(section, courseTitle, this.#studentModel)
      .then((items) => {
        this.setSectionContent(items);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        this.emit('error', { message, recoverable: true });
        // Transition to error state so UI can show it persistently
        this.#setState('error');
      });
  }

  // --- Content Loading ---
  // Called by the content generator after it produces items for the section.
  // This is the bridge between the async LLM call and the engine state machine.

  setSectionContent(items: ContentItem[]): void {
    this.#requireState('setSectionContent', 'loading');

    const section = this.currentSection!;
    this.#sectionItems = items.map(copyContentItem);
    this.#allGeneratedContent[section.id] = items.map(copyContentItem);
    this.#currentItemIndex = 0;

    this.emit('contentReady', {
      items: this.#sectionItems.map(copyContentItem),
      section,
    });

    this.#setState('practicing');
    this.#emitCurrentItem();

    // Trigger prefetch for the next section now that current content is ready
    this.#triggerPrefetch(this.#currentSectionIndex);
  }

  #triggerPrefetch(sectionIndex: number): void {
    if (!this.#prefetcher) {
      return;
    }

    this.#prefetcher.prefetch(sectionIndex, this.#studentModel).catch((_err) => {
      // Log but don't crash — prefetching is non-critical.
      // We log a generic message to avoid leaking provider-specific error details.
      console.error('Background prefetch failed: non-critical error during generation');
    });
  }

  // --- Student Interaction ---

  submitAnswer(answer: StudentAnswer): AnswerResult {
    this.#requireState('submitAnswer', 'practicing');

    const item = this.currentItem;
    if (!item || item.type === 'explanation') {
      throw new InvalidTransitionError('submitAnswer', 'current item is not a question');
    }

    const result = this.#gradeAnswer(item, answer);
    this.#lastAnswerResult = copyAnswerResult(result);

    // Update mastery
    this.#updateMastery(result);

    this.#setState('answered');
    this.emit('answerResult', {
      result: copyAnswerResult(result),
      studentState: this.studentState,
      progress: this.sessionProgress,
    });

    return copyAnswerResult(result);
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
    this.#studentModel.recordAnswer({
      topicId: result.topicId,
      correct: result.correct,
    });
  }

  // --- Grading ---

  #gradeAnswer(question: Question, answer: StudentAnswer): AnswerResult {
    if (question.type !== answer.type) {
      return {
        correct: false,
        questionId: question.id,
        topicId: question.topicId,
        userAnswer: copyStudentAnswer(answer),
        correctAnswer: this.#describeCorrectAnswer(question),
        explanation: 'Answer type does not match question type.',
      };
    }

    const correct = this.#checkCorrectness(question, answer);

    return {
      correct,
      questionId: question.id,
      topicId: question.topicId,
      userAnswer: copyStudentAnswer(answer),
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
      case 'checklist': {
        const a = answer as { type: 'checklist'; checkedIndices: number[] };
        const checked = new Set(a.checkedIndices);
        return (
          a.checkedIndices.length === question.items.length &&
          checked.size === question.items.length &&
          question.items.every((_, index) => checked.has(index))
        );
      }
      case 'code':
      case 'self-evaluation': {
        const a = answer as { type: 'self-evaluation'; selectedIndex: number };
        return (
          Number.isInteger(a.selectedIndex) &&
          a.selectedIndex >= 0 &&
          a.selectedIndex < question.options.length
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
      case 'checklist':
        return 'Completion of all steps';
      case 'code':
      case 'self-evaluation':
        return 'Self-assessment submitted';
    }
  }

  // --- Persistence ---

  serialize(): EngineSnapshot {
    const allGeneratedContent: Record<string, ContentItem[]> = {};
    for (const [id, items] of Object.entries(this.#allGeneratedContent)) {
      allGeneratedContent[id] = items.map(copyContentItem);
    }

    return {
      version: SNAPSHOT_VERSION,
      state: this.#state,
      curriculum: this.#curriculum ? copyCurriculumPlan(this.#curriculum) : null,
      currentSectionIndex: this.#currentSectionIndex,
      currentItemIndex: this.#currentItemIndex,
      sectionItems: this.#sectionItems.map(copyContentItem),
      allGeneratedContent,
      studentState: this.#studentModel.getState(),
      lastAnswerResult: this.#lastAnswerResult
        ? copyAnswerResult(this.#lastAnswerResult)
        : null,
    };
  }

  static restore(snapshot: EngineSnapshot, config: CourseEngineConfig): CourseEngine {
    if (snapshot.version !== SNAPSHOT_VERSION) {
      // Migrate version 3 to version 4
      if (snapshot.version === 3) {
        snapshot = {
          ...snapshot,
          version: SNAPSHOT_VERSION,
          allGeneratedContent: isValidGeneratedContentRecord(snapshot.allGeneratedContent)
            ? snapshot.allGeneratedContent
            : {},
        };
      } else {
        throw new Error(
          `Unsupported snapshot version: ${snapshot.version} (expected ${SNAPSHOT_VERSION})`
        );
      }
    }

    // Constructor does not emit events for idle state.
    // We overwrite all state from the snapshot.
    // Restore does NOT emit events — the consumer must resync explicitly.
    const engine = new CourseEngine(config);
    engine.#state = snapshot.state;

    // Fix: If we restore into 'loading' or 'error' state, we'll stay there forever
    // (or without an error message for 'error'). Revert to 'ready'.
    if (engine.#state === 'loading' || engine.#state === 'error') {
      engine.#state = 'ready';
    }

    engine.#curriculum = snapshot.curriculum
      ? copyCurriculumPlan(snapshot.curriculum)
      : null;

    if (engine.#prefetcher && engine.#curriculum) {
      engine.#prefetcher.setCurriculum(engine.#curriculum);
    }

    engine.#currentSectionIndex = snapshot.currentSectionIndex;
    engine.#currentItemIndex = snapshot.currentItemIndex;
    engine.#sectionItems = snapshot.sectionItems.map(copyContentItem);

    const allGeneratedContent: Record<string, ContentItem[]> = {};
    if (snapshot.allGeneratedContent) {
      for (const [id, items] of Object.entries(snapshot.allGeneratedContent)) {
        allGeneratedContent[id] = items.map(copyContentItem);
      }
    }
    engine.#allGeneratedContent = allGeneratedContent;

    engine.#studentModel = new StudentModel(snapshot.studentState);
    engine.#lastAnswerResult = snapshot.lastAnswerResult
      ? copyAnswerResult(snapshot.lastAnswerResult)
      : null;
    return engine;
  }
}
