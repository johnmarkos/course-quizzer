// --- Course Storage ---
// Persists course records to localStorage. Each record holds a curriculum plan,
// an optional engine snapshot, and timestamps. The API key is never stored.

import {
  validateCurriculumPlan,
  validateEngineSnapshot,
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
  snapshot?: EngineSnapshot | null;
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

function validateSnapshot(value: unknown): EngineSnapshot | null {
  const sanitized = isPlainObject(value)
    ? sanitizeSnapshot(value as EngineSnapshot)
    : value;
  return validateEngineSnapshot(sanitized);
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

export function importCourse(
  input: { title: string; curriculum: CurriculumPlan; snapshot: EngineSnapshot },
  storage: Storage
): string {
  const now = new Date().toISOString();

  const validatedSnapshot = validateSnapshot(input.snapshot);
  if (!validatedSnapshot) {
    throw new Error('Invalid course snapshot in import data');
  }

  const record: CourseRecord = {
    id: generateId(),
    title: input.title,
    curriculum: deepCopy(input.curriculum),
    snapshot: deepCopy(validatedSnapshot),
    createdAt: now,
    updatedAt: now,
  };

  const records = loadRecords(storage);
  records.push(record);
  saveRecords(records, storage);

  return record.id;
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
    record.snapshot = input.snapshot ? deepCopy(sanitizeSnapshot(input.snapshot)) : null;
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
