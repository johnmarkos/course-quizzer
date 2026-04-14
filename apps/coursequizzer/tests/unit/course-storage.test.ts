import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createCourse,
  getCourse,
  importCourse,
  listCourses,
  updateCourse,
  deleteCourse,
  COURSES_STORAGE_KEY,
  type CourseRecord,
} from '../../src/lib/storage/course-storage.js';
import {
  SNAPSHOT_VERSION,
  type CurriculumPlan,
  type EngineSnapshot,
} from 'quizzer-engine';

// --- localStorage mock ---

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// --- Test fixtures ---

function mockCurriculumPlan(): CurriculumPlan {
  return {
    title: 'Test Course',
    description: 'A valid curriculum used for storage tests.',
    sections: [
      {
        id: 's1',
        title: 'Section 1',
        order: 0,
        topics: [
          {
            id: 't1',
            title: 'Topic 1',
            description: 'A test topic.',
          },
        ],
      },
    ],
  };
}

function mockSnapshot(): EngineSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    state: 'ready',
    curriculum: mockCurriculumPlan(),
    currentSectionIndex: 0,
    currentItemIndex: 0,
    sectionItems: [],
    allGeneratedContent: {},
    studentState: { masteryByTopic: {}, gaps: [] },
    lastAnswerResult: null,
  };
}

describe('course-storage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createLocalStorageMock();
  });

  // --- createCourse ---

  it('creates a course and returns a record with an id and timestamps', () => {
    const record = createCourse(
      { title: 'Algorithms', curriculum: mockCurriculumPlan() },
      storage
    );
    expect(record.id).toBeDefined();
    expect(record.title).toBe('Algorithms');
    expect(record.curriculum).toEqual(mockCurriculumPlan());
    expect(record.snapshot).toBeNull();
    expect(record.createdAt).toBeDefined();
    expect(record.updatedAt).toBeDefined();
  });

  it('generates unique ids for different courses', () => {
    const a = createCourse({ title: 'A', curriculum: mockCurriculumPlan() }, storage);
    const b = createCourse({ title: 'B', curriculum: mockCurriculumPlan() }, storage);
    expect(a.id).not.toBe(b.id);
  });

  it('persists to localStorage', () => {
    createCourse({ title: 'Algorithms', curriculum: mockCurriculumPlan() }, storage);
    expect(storage.setItem).toHaveBeenCalledWith(COURSES_STORAGE_KEY, expect.any(String));
  });

  // --- getCourse ---

  it('retrieves a stored course by id', () => {
    const created = createCourse(
      { title: 'Algorithms', curriculum: mockCurriculumPlan() },
      storage
    );
    const loaded = getCourse(created.id, storage);
    expect(loaded).toEqual(created);
  });

  it('returns null for a non-existent id', () => {
    expect(getCourse('no-such-id', storage)).toBeNull();
  });

  // --- listCourses ---

  it('lists all stored courses', () => {
    createCourse({ title: 'A', curriculum: mockCurriculumPlan() }, storage);
    createCourse({ title: 'B', curriculum: mockCurriculumPlan() }, storage);
    const list = listCourses(storage);
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.title).sort()).toEqual(['A', 'B']);
  });

  it('returns an empty array when no courses exist', () => {
    expect(listCourses(storage)).toEqual([]);
  });

  // --- updateCourse ---

  it('updates a course snapshot and bumps updatedAt', () => {
    const created = createCourse(
      { title: 'Algorithms', curriculum: mockCurriculumPlan() },
      storage
    );

    const snapshot = mockSnapshot();
    const updated = updateCourse(created.id, { snapshot }, storage);

    expect(updated).not.toBeNull();
    expect(updated!.snapshot).toEqual(snapshot);
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime()
    );
  });

  it('updates a course title', () => {
    const created = createCourse(
      { title: 'Old', curriculum: mockCurriculumPlan() },
      storage
    );
    const updated = updateCourse(created.id, { title: 'New' }, storage);
    expect(updated!.title).toBe('New');
  });

  it('returns null when updating a non-existent course', () => {
    expect(updateCourse('no-such-id', { title: 'X' }, storage)).toBeNull();
  });

  // --- deleteCourse ---

  it('deletes a course by id', () => {
    const created = createCourse(
      { title: 'Algorithms', curriculum: mockCurriculumPlan() },
      storage
    );
    const deleted = deleteCourse(created.id, storage);
    expect(deleted).toBe(true);
    expect(getCourse(created.id, storage)).toBeNull();
  });

  it('returns false when deleting a non-existent course', () => {
    expect(deleteCourse('no-such-id', storage)).toBe(false);
  });

  // --- Malformed data handling ---

  it('returns empty list when localStorage contains invalid JSON', () => {
    storage.setItem(COURSES_STORAGE_KEY, 'not valid json{{{');
    expect(listCourses(storage)).toEqual([]);
  });

  it('returns empty list when localStorage contains a non-array', () => {
    storage.setItem(COURSES_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(listCourses(storage)).toEqual([]);
  });

  it('filters out records missing required fields', () => {
    const valid: CourseRecord = {
      id: 'valid-1',
      title: 'Valid',
      curriculum: mockCurriculumPlan(),
      snapshot: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const invalid = { id: 'bad', title: 'Missing fields' };
    storage.setItem(COURSES_STORAGE_KEY, JSON.stringify([valid, invalid]));
    const list = listCourses(storage);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('valid-1');
  });

  it('filters out records with malformed curriculum payloads', () => {
    const invalidCurriculumRecord = {
      id: 'bad-curriculum',
      title: 'Broken curriculum',
      curriculum: {
        title: 'Broken curriculum',
        description: 'Missing section order and topic descriptions.',
        sections: [
          {
            id: 's1',
            title: 'Section 1',
            topics: [{ id: 't1', title: 'Topic 1' }],
          },
        ],
      },
      snapshot: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.setItem(COURSES_STORAGE_KEY, JSON.stringify([invalidCurriculumRecord]));

    expect(listCourses(storage)).toEqual([]);
    expect(getCourse('bad-curriculum', storage)).toBeNull();
  });

  it('nulls out malformed snapshot payloads before returning persisted records', () => {
    const recordWithBadSnapshot = {
      id: 'bad-snapshot',
      title: 'Broken snapshot',
      curriculum: mockCurriculumPlan(),
      snapshot: {
        version: SNAPSHOT_VERSION,
        state: 'ready',
        curriculum: mockCurriculumPlan(),
        currentSectionIndex: '0',
        currentItemIndex: 0,
        sectionItems: [],
        studentState: { masteryByTopic: {}, gaps: [] },
        lastAnswerResult: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.setItem(COURSES_STORAGE_KEY, JSON.stringify([recordWithBadSnapshot]));

    const loaded = getCourse('bad-snapshot', storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.snapshot).toBeNull();
    expect(listCourses(storage)[0].snapshot).toBeNull();
  });

  it('nulls out snapshots with unsupported persisted versions', () => {
    const recordWithOldSnapshot = {
      id: 'old-snapshot',
      title: 'Old snapshot',
      curriculum: mockCurriculumPlan(),
      snapshot: {
        ...mockSnapshot(),
        version: 2,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.setItem(COURSES_STORAGE_KEY, JSON.stringify([recordWithOldSnapshot]));

    expect(getCourse('old-snapshot', storage)?.snapshot).toBeNull();
  });

  it('rejects imported version 3 snapshots with malformed allGeneratedContent', () => {
    const version3Snapshot = {
      ...mockSnapshot(),
      version: 3,
      allGeneratedContent: { bad: 1 },
    } as EngineSnapshot;

    expect(() =>
      importCourse(
        {
          title: 'Imported course',
          curriculum: mockCurriculumPlan(),
          snapshot: version3Snapshot,
        },
        storage
      )
    ).toThrow('Invalid course snapshot in import data');
  });

  // --- Security: no API key in persisted data ---

  it('does not persist an apiKey field in snapshots', () => {
    const snapshotWithKey = {
      ...mockSnapshot(),
      apiKey: 'sk-ant-secret',
    } as EngineSnapshot & { apiKey?: string };

    const created = createCourse(
      { title: 'Course', curriculum: mockCurriculumPlan() },
      storage
    );
    updateCourse(created.id, { snapshot: snapshotWithKey }, storage);

    const raw = storage.getItem(COURSES_STORAGE_KEY)!;
    expect(raw).not.toContain('sk-ant-secret');
  });

  // --- Defensive copies ---

  it('returns defensive copies — mutating a returned record does not affect storage', () => {
    const created = createCourse(
      { title: 'Algorithms', curriculum: mockCurriculumPlan() },
      storage
    );
    created.title = 'Mutated';
    const loaded = getCourse(created.id, storage);
    expect(loaded!.title).toBe('Algorithms');
  });
});
