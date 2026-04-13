// --- Engine Session Store ---
// Owns the active CourseEngine instance and translates engine events into
// reactive Svelte 5 state. Consumers read state via getters; all mutations
// flow through engine actions. The UI never computes mastery or adaptive
// logic — it reads what the engine emits.

import {
  CourseEngine,
  type CourseEngineConfig,
  type CurriculumPlan,
  type EngineState,
  type EngineSnapshot,
  type ContentItem,
  type AnswerResult,
  type StudentAnswer,
  type StudentState,
  type SessionProgress,
  type Section,
  type Listener,
} from 'quizzer-engine';
import { updateCourse } from '../storage/course-storage.js';
import { normalizeError, scrubSensitiveData } from '../errors/app-errors.js';

// --- Types ---

type SectionInfo = {
  section: Section;
  sectionIndex: number;
  totalSections: number;
};

type ItemInfo = {
  item: ContentItem;
  itemIndex: number;
  totalItems: number;
};

type ResultInfo = {
  result: AnswerResult;
  studentState: StudentState;
  progress: SessionProgress;
};

type ErrorInfo = {
  message: string;
  recoverable: boolean;
};

export type EngineSessionConfig = {
  apiKey: string;
  snapshot?: EngineSnapshot;
  courseId?: string;
  storage?: Storage;
};

export type EngineSession = ReturnType<typeof createEngineSession>;

// --- Factory ---

export function createEngineSession(config: EngineSessionConfig) {
  const engineConfig: CourseEngineConfig = { apiKey: config.apiKey };

  // --- Attempt snapshot restore, fall back to fresh engine on failure ---

  let engine: CourseEngine | null;
  let didRestoreFail = false;

  if (config.snapshot) {
    try {
      engine = CourseEngine.restore(config.snapshot, engineConfig);
    } catch {
      engine = new CourseEngine(engineConfig);
      didRestoreFail = true;

      // Clear the bad snapshot from storage so the next load doesn't repeat the failure
      if (config.courseId && config.storage) {
        updateCourse(config.courseId, { snapshot: null }, config.storage);
      }
    }
  } else {
    engine = new CourseEngine(engineConfig);
  }

  // --- Reactive state ---

  let engineState = $state<EngineState>(engine.state);
  let curriculum = $state<CurriculumPlan | null>(engine.curriculum);
  let currentSection = $state<SectionInfo | null>(null);
  let currentItem = $state<ItemInfo | null>(null);
  let lastResult = $state<ResultInfo | null>(null);
  let studentState = $state<StudentState | null>(null);
  let progress = $state<SessionProgress | null>(null);
  let apiLoading = $state(false);
  let error = $state<ErrorInfo | null>(null);

  // If restoring successfully, sync initial state from snapshot
  if (config.snapshot && !didRestoreFail && engine) {
    engineState = engine.state;
    curriculum = engine.curriculum;
    studentState = engine.studentState;
    progress = engine.sessionProgress;
  }

  // --- Event handlers ---

  const onStateChange: Listener<'stateChange'> = (payload) => {
    engineState = payload.to;
  };

  const onSyllabusLoaded: Listener<'syllabusLoaded'> = (payload) => {
    curriculum = payload.curriculum;
  };

  const onSectionStart: Listener<'sectionStart'> = (payload) => {
    currentSection = {
      section: payload.section,
      sectionIndex: payload.sectionIndex,
      totalSections: payload.totalSections,
    };
    // Reset item and result state for the new section
    currentItem = null;
    lastResult = null;
  };

  const onItemShow: Listener<'itemShow'> = (payload) => {
    currentItem = {
      item: payload.item,
      itemIndex: payload.itemIndex,
      totalItems: payload.totalItems,
    };
  };

  const onAnswerResult: Listener<'answerResult'> = (payload) => {
    lastResult = {
      result: payload.result,
      studentState: payload.studentState,
      progress: payload.progress,
    };
    studentState = payload.studentState;
    progress = payload.progress;
    autoSave();
  };

  const onSectionComplete: Listener<'sectionComplete'> = (payload) => {
    studentState = payload.studentState;
    progress = payload.progress;
    autoSave();
  };

  const onCourseComplete: Listener<'courseComplete'> = (payload) => {
    studentState = payload.studentState;
    progress = payload.progress;
    autoSave();
  };

  const onApiCallStart: Listener<'apiCallStart'> = () => {
    apiLoading = true;
  };

  const onApiCallComplete: Listener<'apiCallComplete'> = () => {
    apiLoading = false;
  };

  const onError: Listener<'error'> = (payload) => {
    // Scrub sensitive data directly — no need to wrap in Error and classify
    error = {
      message: scrubSensitiveData(payload.message),
      recoverable: payload.recoverable,
    };
  };

  // --- Subscribe to engine events ---

  function subscribe(eng: CourseEngine): void {
    eng.on('stateChange', onStateChange);
    eng.on('syllabusLoaded', onSyllabusLoaded);
    eng.on('sectionStart', onSectionStart);
    eng.on('itemShow', onItemShow);
    eng.on('answerResult', onAnswerResult);
    eng.on('sectionComplete', onSectionComplete);
    eng.on('courseComplete', onCourseComplete);
    eng.on('apiCallStart', onApiCallStart);
    eng.on('apiCallComplete', onApiCallComplete);
    eng.on('error', onError);
  }

  function unsubscribe(eng: CourseEngine): void {
    eng.off('stateChange', onStateChange);
    eng.off('syllabusLoaded', onSyllabusLoaded);
    eng.off('sectionStart', onSectionStart);
    eng.off('itemShow', onItemShow);
    eng.off('answerResult', onAnswerResult);
    eng.off('sectionComplete', onSectionComplete);
    eng.off('courseComplete', onCourseComplete);
    eng.off('apiCallStart', onApiCallStart);
    eng.off('apiCallComplete', onApiCallComplete);
    eng.off('error', onError);
  }

  subscribe(engine);

  // --- Auto-save ---

  function autoSave(): void {
    if (!config.courseId || !config.storage || !engine) return;
    try {
      const snapshot = engine.serialize();
      updateCourse(config.courseId, { snapshot }, config.storage);
    } catch (err) {
      // Surface storage errors (e.g., quota exceeded) as recoverable engine errors
      const normalized = normalizeError(err);
      error = { message: normalized.message, recoverable: true };
    }
  }

  // --- Public API ---

  return {
    // Reactive state (read via getters)
    get engineState() {
      return engineState;
    },
    get curriculum() {
      return curriculum;
    },
    get currentSection() {
      return currentSection;
    },
    get currentItem() {
      return currentItem;
    },
    get lastResult() {
      return lastResult;
    },
    get studentState() {
      return studentState;
    },
    get progress() {
      return progress;
    },
    get apiLoading() {
      return apiLoading;
    },
    get error() {
      return error;
    },
    get restoreFailed() {
      return didRestoreFail;
    },

    // --- Engine actions ---

    loadCurriculum(plan: CurriculumPlan): void {
      if (!engine) throw new Error('Session is disposed');
      engine.loadCurriculum(plan);
    },

    startSection(sectionId: string): void {
      if (!engine) throw new Error('Session is disposed');
      engine.startSection(sectionId);
    },

    setSectionContent(items: ContentItem[]): void {
      if (!engine) throw new Error('Session is disposed');
      engine.setSectionContent(items);
    },

    submitAnswer(answer: StudentAnswer): AnswerResult {
      if (!engine) throw new Error('Session is disposed');
      return engine.submitAnswer(answer);
    },

    nextItem(): void {
      if (!engine) throw new Error('Session is disposed');
      engine.nextItem();
    },

    skipQuestion(): void {
      if (!engine) throw new Error('Session is disposed');
      engine.skipQuestion();
    },

    nextSection(): void {
      if (!engine) throw new Error('Session is disposed');
      engine.nextSection();
    },

    // --- Lifecycle ---

    serialize(): EngineSnapshot | null {
      if (!engine) return null;
      return engine.serialize();
    },

    dispose(): void {
      if (engine) {
        unsubscribe(engine);
        engine = null;
      }
      engineState = 'idle';
      curriculum = null;
      currentSection = null;
      currentItem = null;
      lastResult = null;
      studentState = null;
      progress = null;
      apiLoading = false;
      error = null;
    },
  };
}
