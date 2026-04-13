// --- Course Storage ---
// Persists course records to localStorage. Each record holds a curriculum plan,
// an optional engine snapshot, and timestamps. The API key is never stored.

import {
  validateCurriculumPlan,
  SNAPSHOT_VERSION,
  type CurriculumPlan,
  type EngineSnapshot,
} from 'quizzer-engine';

export const COURSES_STORAGE_KEY = 'coursequizzer:courses';

export type CourseRecord = {
  id: string;
  title: string;
  curriculum: CurriculumPlan;
  snapshot: EngineSnapshot | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

export type CreateCourseInput = {
  title: string;
  curriculum: CurriculumPlan;
};

export type UpdateCourseInput = {
  title?: string;
  snapshot?: EngineSnapshot;
  curriculum?: CurriculumPlan;
};

// --- Helpers ---

function generateId(): string {
  return crypto.randomUUID();
}

/** Strip any apiKey field from a snapshot before persisting. */
function sanitizeSnapshot(snapshot: EngineSnapshot): EngineSnapshot {
  const copy = { ...snapshot };
  delete (copy as Record<string, unknown>)['apiKey'];
  return copy;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isValidEngineState(value: unknown): boolean {
  return (
    value === 'idle' ||
    value === 'planning' ||
    value === 'ready' ||
    value === 'loading' ||
    value === 'practicing' ||
    value === 'answered' ||
    value === 'sectionComplete' ||
    value === 'complete'
  );
}

function isValidStudentState(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (!isPlainObject(value.masteryByTopic) || !isStringArray(value.gaps)) return false;

  return Object.entries(value.masteryByTopic).every(([topicId, mastery]) => {
    if (!isPlainObject(mastery)) return false;
    return (
      mastery.topicId === topicId &&
      typeof mastery.score === 'number' &&
      typeof mastery.questionsAnswered === 'number' &&
      typeof mastery.questionsCorrect === 'number'
    );
  });
}

function isValidStudentAnswer(value: unknown): boolean {
  if (!isPlainObject(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'multiple-choice':
      return typeof value.selectedIndex === 'number';
    case 'numeric-input':
      return typeof value.value === 'number';
    case 'ordering':
      return (
        Array.isArray(value.order) &&
        value.order.every((entry) => typeof entry === 'number')
      );
    case 'multi-select':
      return (
        Array.isArray(value.selectedIndices) &&
        value.selectedIndices.every((entry) => typeof entry === 'number')
      );
    case 'two-stage':
      return (
        typeof value.selectedIndex === 'number' &&
        typeof value.followUpSelectedIndex === 'number'
      );
    default:
      return false;
  }
}

function isValidAnswerResult(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.correct === 'boolean' &&
    typeof value.questionId === 'string' &&
    typeof value.topicId === 'string' &&
    typeof value.correctAnswer === 'string' &&
    (value.explanation === undefined || typeof value.explanation === 'string') &&
    isValidStudentAnswer(value.userAnswer)
  );
}

function isValidContentItem(value: unknown): boolean {
  if (!isPlainObject(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'explanation':
      return (
        typeof value.topicId === 'string' &&
        typeof value.title === 'string' &&
        typeof value.content === 'string'
      );
    case 'multiple-choice':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.options) &&
        typeof value.correctIndex === 'number'
      );
    case 'numeric-input':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        typeof value.correctValue === 'number' &&
        (value.tolerance === undefined || typeof value.tolerance === 'number') &&
        (value.unit === undefined || typeof value.unit === 'string')
      );
    case 'ordering':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.items) &&
        Array.isArray(value.correctOrder) &&
        value.correctOrder.every((entry) => typeof entry === 'number')
      );
    case 'multi-select':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.options) &&
        Array.isArray(value.correctIndices) &&
        value.correctIndices.every((entry) => typeof entry === 'number')
      );
    case 'two-stage':
      return (
        typeof value.id === 'string' &&
        typeof value.topicId === 'string' &&
        typeof value.question === 'string' &&
        isStringArray(value.options) &&
        typeof value.correctIndex === 'number' &&
        typeof value.followUp === 'string' &&
        isStringArray(value.followUpOptions) &&
        typeof value.followUpCorrectIndex === 'number'
      );
    default:
      return false;
  }
}

function validateSnapshot(value: unknown): EngineSnapshot | null {
  if (!isPlainObject(value)) return null;

  const snapshot = sanitizeSnapshot(value as EngineSnapshot);

  if (
    snapshot.version !== SNAPSHOT_VERSION ||
    !isValidEngineState(snapshot.state) ||
    !Number.isInteger(snapshot.currentSectionIndex) ||
    !Number.isInteger(snapshot.currentItemIndex) ||
    !Array.isArray(snapshot.sectionItems) ||
    !snapshot.sectionItems.every(isValidContentItem) ||
    !isValidStudentState(snapshot.studentState) ||
    (snapshot.curriculum !== null && !isValidCurriculum(snapshot.curriculum)) ||
    !('lastAnswerResult' in snapshot) ||
    (snapshot.lastAnswerResult !== null &&
      !isValidAnswerResult(snapshot.lastAnswerResult))
  ) {
    return null;
  }

  return deepCopy(snapshot);
}

function isValidCurriculum(value: unknown): value is CurriculumPlan {
  try {
    validateCurriculumPlan(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeRecord(value: unknown): CourseRecord | null {
  if (!isPlainObject(value)) return null;
  if (!isValidCurriculum(value.curriculum)) return null;

  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  const snapshot =
    value.snapshot === null || value.snapshot === undefined
      ? null
      : validateSnapshot(value.snapshot);

  return {
    id: value.id,
    title: value.title,
    curriculum: deepCopy(value.curriculum),
    snapshot,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function loadRecords(storage: Storage): CourseRecord[] {
  const raw = storage.getItem(COURSES_STORAGE_KEY);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((record) => normalizeRecord(record))
    .filter((record): record is CourseRecord => record !== null);
}

function saveRecords(records: CourseRecord[], storage: Storage): void {
  storage.setItem(COURSES_STORAGE_KEY, JSON.stringify(records));
}

/** Deep clone via JSON round-trip for defensive copies. */
function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// --- Public API ---

export function createCourse(input: CreateCourseInput, storage: Storage): CourseRecord {
  const now = new Date().toISOString();
  const record: CourseRecord = {
    id: generateId(),
    title: input.title,
    curriculum: deepCopy(input.curriculum),
    snapshot: null,
    createdAt: now,
    updatedAt: now,
  };

  const records = loadRecords(storage);
  records.push(record);
  saveRecords(records, storage);

  return deepCopy(record);
}

export function getCourse(id: string, storage: Storage): CourseRecord | null {
  const records = loadRecords(storage);
  const found = records.find((r) => r.id === id);
  return found ? deepCopy(found) : null;
}

export function listCourses(storage: Storage): CourseRecord[] {
  return deepCopy(loadRecords(storage));
}

export function updateCourse(
  id: string,
  input: UpdateCourseInput,
  storage: Storage
): CourseRecord | null {
  const records = loadRecords(storage);
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const record = records[index];
  if (input.title !== undefined) record.title = input.title;
  if (input.curriculum !== undefined) record.curriculum = deepCopy(input.curriculum);
  if (input.snapshot !== undefined) {
    record.snapshot = deepCopy(sanitizeSnapshot(input.snapshot));
  }
  record.updatedAt = new Date().toISOString();

  saveRecords(records, storage);
  return deepCopy(record);
}

export function deleteCourse(id: string, storage: Storage): boolean {
  const records = loadRecords(storage);
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return false;

  records.splice(index, 1);
  saveRecords(records, storage);
  return true;
}
