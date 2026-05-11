// --- Event System ---
// Typed event emitter for engine-to-UI communication.
// The engine emits events with all data the UI needs to render.
// The UI never reaches back into the engine for display info.

import type { CurriculumPlan, Section } from '../curriculum/types.js';
import type {
  ContentItem,
  Explanation,
  Question,
  AnswerResult,
} from '../content/types.js';
import type { StudentState, SessionProgress } from '../student/types.js';
import type { EngineState } from './types.js';

export type ApiCallEvent = {
  id: string;
  purpose: string;
};

export type EngineEventMap = {
  stateChange: { from: EngineState; to: EngineState };
  error: { message: string; recoverable: boolean };

  // --- Syllabus lifecycle ---
  syllabusLoaded: { curriculum: CurriculumPlan };

  // --- Section lifecycle ---
  sectionStart: { section: Section; sectionIndex: number; totalSections: number };
  contentReady: { items: ContentItem[]; section: Section };

  // --- Content/quiz loop ---
  itemShow: { item: ContentItem; itemIndex: number; totalItems: number };
  answerResult: {
    result: AnswerResult;
    studentState: StudentState;
    progress: SessionProgress;
  };

  // --- Section/course completion ---
  sectionComplete: {
    section: Section;
    studentState: StudentState;
    progress: SessionProgress;
  };
  courseComplete: {
    studentState: StudentState;
    progress: SessionProgress;
  };

  // --- API activity (for loading indicators) ---
  apiCallStart: ApiCallEvent;
  apiCallComplete: ApiCallEvent;
};

export type EngineEvent = keyof EngineEventMap;
export type Listener<E extends EngineEvent> = (payload: EngineEventMap[E]) => void;

type ListenerEntry = {
  event: EngineEvent;
  listener: Listener<never>;
};

export class EventEmitter {
  #listeners: ListenerEntry[] = [];

  on<E extends EngineEvent>(event: E, listener: Listener<E>): void {
    this.#listeners.push({
      event,
      listener: listener as Listener<never>,
    });
  }

  off<E extends EngineEvent>(event: E, listener: Listener<E>): void {
    this.#listeners = this.#listeners.filter(
      (entry) => !(entry.event === event && entry.listener === listener)
    );
  }

  protected emit<E extends EngineEvent>(event: E, payload: EngineEventMap[E]): void {
    for (const entry of this.#listeners) {
      if (entry.event === event) {
        (entry.listener as Listener<E>)(payload);
      }
    }
  }
}
