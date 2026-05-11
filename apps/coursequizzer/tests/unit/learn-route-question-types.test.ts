// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AnswerResult,
  ContentItem,
  CurriculumPlan,
  EngineSnapshot,
  StudentAnswer,
} from 'quizzer-engine';
import LearnPage from '../../src/routes/course/[courseId]/learn/+page.svelte';
import { COURSES_STORAGE_KEY } from '../../src/lib/storage/course-storage.js';
import { API_KEY_STORAGE_KEY } from '../../src/lib/stores/api-key.js';
import type { EngineSession } from '../../src/lib/stores/engine-session.svelte.js';
import { page as mockPage } from './shims/app-state.js';

const { createEngineSessionMock } = vi.hoisted(() => ({
  createEngineSessionMock: vi.fn(),
}));

vi.mock('$lib/stores/engine-session.svelte.js', () => ({
  createEngineSession: createEngineSessionMock,
}));

// --- Test fixtures ---

const COURSE_ID = 'course-new-question-types';

function mockCurriculumPlan(): CurriculumPlan {
  return {
    title: 'Applied Practice',
    description: 'A course with interactive practice items.',
    sections: [
      {
        id: 's1',
        title: 'Hands-on Work',
        order: 0,
        topics: [
          {
            id: 't1',
            title: 'Practice Topic',
            description: 'A topic with new question types.',
          },
        ],
      },
    ],
  };
}

function storeCourse(curriculum: CurriculumPlan): void {
  const now = new Date('2026-05-11T12:00:00.000Z').toISOString();
  localStorage.setItem(API_KEY_STORAGE_KEY, 'test-api-key');
  localStorage.setItem(
    COURSES_STORAGE_KEY,
    JSON.stringify([
      {
        id: COURSE_ID,
        title: curriculum.title,
        curriculum,
        snapshot: null,
        createdAt: now,
        updatedAt: now,
      },
    ])
  );
}

function answerResult(answer: StudentAnswer, item: ContentItem): AnswerResult {
  return {
    correct: true,
    questionId: 'id' in item ? item.id : 'explanation',
    topicId: item.topicId,
    userAnswer: answer,
    correctAnswer: 'Submitted',
  };
}

function createPracticingSession(item: ContentItem) {
  const curriculum = mockCurriculumPlan();
  const submitAnswer = vi.fn((answer: StudentAnswer) => answerResult(answer, item));
  const submitAnswerAsync = vi.fn(async (answer: StudentAnswer) =>
    answerResult(answer, item)
  );
  const session: EngineSession = {
    engineState: 'practicing',
    curriculum,
    currentSection: {
      section: curriculum.sections[0],
      sectionIndex: 0,
      totalSections: curriculum.sections.length,
    },
    currentItem: {
      item,
      itemIndex: 0,
      totalItems: 1,
    },
    lastResult: null,
    studentState: null,
    progress: null,
    apiLoading: false,
    error: null,
    restoreFailed: false,
    loadCurriculum: vi.fn(),
    startSection: vi.fn(),
    setSectionContent: vi.fn(),
    submitAnswer,
    submitAnswerAsync,
    nextItem: vi.fn(),
    skipQuestion: vi.fn(),
    nextSection: vi.fn(),
    serialize: vi.fn((): EngineSnapshot | null => null),
    dispose: vi.fn(),
  };

  return { session, submitAnswer, submitAnswerAsync };
}

async function renderLearnPageWithItem(item: ContentItem) {
  const curriculum = mockCurriculumPlan();
  storeCourse(curriculum);

  const { session, submitAnswer, submitAnswerAsync } = createPracticingSession(item);
  createEngineSessionMock.mockReturnValue(session);

  render(LearnPage);
  await screen.findByRole('heading', {
    name: item.type === 'explanation' ? item.title : item.question,
  });

  return { session, submitAnswer, submitAnswerAsync };
}

// --- Tests ---

describe('learn route new question types', () => {
  beforeEach(() => {
    mockPage.params.courseId = COURSE_ID;
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders checklist controls and submits checked indices', async () => {
    const { submitAnswer } = await renderLearnPageWithItem({
      type: 'checklist',
      id: 'checklist-1',
      topicId: 't1',
      question: 'Which setup steps have you completed?',
      items: ['Draft the hypothesis', 'Collect data', 'Validate results'],
    });

    const submitButton = screen.getByRole('button', { name: 'Confirm Completion' });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    const firstStep = screen.getByRole('button', { name: /Draft the hypothesis/ });
    const thirdStep = screen.getByRole('button', { name: /Validate results/ });

    await fireEvent.click(firstStep);
    await fireEvent.click(thirdStep);

    expect(firstStep.classList.contains('selected')).toBe(true);
    expect(thirdStep.classList.contains('selected')).toBe(true);
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);

    await fireEvent.click(submitButton);

    expect(submitAnswer).toHaveBeenCalledWith({
      type: 'checklist',
      checkedIndices: [0, 2],
    });
  });

  it('renders a code prompt with starter code and submits edited code', async () => {
    const { submitAnswerAsync } = await renderLearnPageWithItem({
      type: 'code',
      id: 'code-1',
      topicId: 't1',
      question: 'Write a helper that returns the first item.',
      language: 'TypeScript',
      initialCode:
        'function first<T>(items: T[]): T | undefined {\n  return undefined;\n}',
    });

    expect(screen.getByText('Language: TypeScript')).toBeTruthy();

    const editor = screen.getByRole('textbox');
    expect((editor as HTMLTextAreaElement).value).toBe(
      'function first<T>(items: T[]): T | undefined {\n  return undefined;\n}'
    );

    await fireEvent.input(editor, {
      target: {
        value: 'function first<T>(items: T[]): T | undefined {\n  return items[0];\n}',
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Submit Code' }));

    expect(submitAnswerAsync).toHaveBeenCalledWith({
      type: 'code',
      code: 'function first<T>(items: T[]): T | undefined {\n  return items[0];\n}',
    });
  });

  it('renders AI tutor feedback as escaped text in the answer result', async () => {
    const curriculum = mockCurriculumPlan();
    storeCourse(curriculum);
    const session: EngineSession = {
      engineState: 'answered',
      curriculum,
      currentSection: {
        section: curriculum.sections[0],
        sectionIndex: 0,
        totalSections: curriculum.sections.length,
      },
      currentItem: null,
      lastResult: {
        result: {
          correct: false,
          questionId: 'code-1',
          topicId: 't1',
          userAnswer: { type: 'code', code: 'alert(1)' },
          correctAnswer: 'Tutor marked this submission incorrect',
          evaluation: {
            verdict: 'incorrect',
            feedback: '<img src=x onerror=alert(1)> Use filter instead of map.',
          },
        },
        studentState: null as never,
        progress: null as never,
      },
      studentState: null,
      progress: null,
      apiLoading: false,
      error: null,
      restoreFailed: false,
      loadCurriculum: vi.fn(),
      startSection: vi.fn(),
      setSectionContent: vi.fn(),
      submitAnswer: vi.fn(),
      submitAnswerAsync: vi.fn(),
      nextItem: vi.fn(),
      skipQuestion: vi.fn(),
      nextSection: vi.fn(),
      serialize: vi.fn((): EngineSnapshot | null => null),
      dispose: vi.fn(),
    };
    createEngineSessionMock.mockReturnValue(session);

    render(LearnPage);

    expect(
      await screen.findByText('<img src=x onerror=alert(1)> Use filter instead of map.')
    ).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });

  it('renders self-evaluation options and submits the selected index', async () => {
    const { submitAnswer } = await renderLearnPageWithItem({
      type: 'self-evaluation',
      id: 'self-eval-1',
      topicId: 't1',
      question: 'How confidently can you complete this task?',
      options: ['Need more practice', 'Mostly there', 'Ready to apply it'],
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Ready to apply it' }));

    expect(submitAnswer).toHaveBeenCalledWith({
      type: 'self-evaluation',
      selectedIndex: 2,
    });
  });
});
