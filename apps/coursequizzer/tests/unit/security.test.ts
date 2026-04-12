import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createEngineSession } from '../../src/lib/stores/engine-session.svelte.js';
import {
  createCourse,
  getCourse,
  listCourses,
  updateCourse,
} from '../../src/lib/storage/course-storage.js';
import type { CurriculumPlan, EngineSnapshot } from 'quizzer-engine';

// --- Helpers ---

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

function mockCurriculumPlan(): CurriculumPlan {
  return {
    title: 'Security Test Course',
    description: 'Testing security constraints.',
    sections: [
      {
        id: 's1',
        title: 'Section 1',
        order: 0,
        topics: [{ id: 't1', title: 'Topic 1', description: 'A topic.' }],
      },
    ],
  };
}

// --- Collect all source files in a directory tree ---

function collectFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && entry !== 'node_modules' && entry !== '.svelte-kit') {
      results.push(...collectFiles(fullPath, ext));
    } else if (entry.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

// --- Static source code security checks ---

describe('source code security scan', () => {
  const appSrcDir = join(__dirname, '../../src');

  it('does not use {@html} in any Svelte component', () => {
    const svelteFiles = collectFiles(appSrcDir, '.svelte');
    const violations: string[] = [];

    for (const file of svelteFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('{@html')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not use eval() or new Function() in any source file', () => {
    const tsFiles = collectFiles(appSrcDir, '.ts');
    const svelteFiles = collectFiles(appSrcDir, '.svelte');
    const allFiles = [...tsFiles, ...svelteFiles];
    const violations: string[] = [];

    for (const file of allFiles) {
      const content = readFileSync(file, 'utf-8');
      // Match eval( but not .evaluate or similar
      if (/\beval\s*\(/.test(content) || /\bnew\s+Function\s*\(/.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not log API keys in any source file', () => {
    const tsFiles = collectFiles(appSrcDir, '.ts');
    const svelteFiles = collectFiles(appSrcDir, '.svelte');
    const allFiles = [...tsFiles, ...svelteFiles];
    const violations: string[] = [];

    for (const file of allFiles) {
      const content = readFileSync(file, 'utf-8');
      // Check for console.log that includes apiKey variable
      if (/console\.\w+\(.*apiKey/i.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});

// --- Runtime security checks ---

describe('API key safety at runtime', () => {
  it('API key is not present in serialized engine snapshots', () => {
    const session = createEngineSession({ apiKey: 'sk-ant-api03-SECRETKEY12345' });
    session.loadCurriculum(mockCurriculumPlan());

    const snapshot = session.serialize()!;
    const json = JSON.stringify(snapshot);

    expect(json).not.toContain('sk-ant-api03-SECRETKEY12345');
    expect(json).not.toContain('SECRETKEY');

    session.dispose();
  });

  it('API key is not present in course records persisted to storage', () => {
    const storage = createLocalStorageMock();
    const session = createEngineSession({
      apiKey: 'sk-ant-api03-PERSISTCHECK',
      courseId: 'test-course',
      storage,
    });

    session.loadCurriculum(mockCurriculumPlan());

    // Create the course in storage so auto-save has a target
    createCourse({ title: 'Test', curriculum: mockCurriculumPlan() }, storage);

    // Check all persisted data
    const courses = listCourses(storage);
    const allStoredData = JSON.stringify(courses);
    expect(allStoredData).not.toContain('sk-ant-api03-PERSISTCHECK');

    session.dispose();
  });

  it('course storage rejects malformed import data gracefully', () => {
    const storage = createLocalStorageMock();

    // Simulate corrupted localStorage
    storage.setItem('cq:courses', 'not-valid-json{{{');
    expect(listCourses(storage)).toEqual([]);

    // Simulate data with wrong shape
    storage.setItem('cq:courses', JSON.stringify([{ invalid: true }]));
    expect(listCourses(storage)).toEqual([]);

    // Simulate array of nulls
    storage.setItem('cq:courses', JSON.stringify([null, undefined, 42]));
    expect(listCourses(storage)).toEqual([]);
  });
});
