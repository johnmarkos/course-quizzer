// --- Integration Test: Full Engine Lifecycle ---
// Tests the complete flow using recorded API responses:
//   syllabus → curriculum plan → content generation → answering → mastery
//
// Uses hand-crafted recorded fixtures that model realistic Claude responses.
// This validates that all components work together end-to-end.
//
// Run with: pnpm test:integration

import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { SyllabusParser } from '../../src/curriculum/SyllabusParser.js';
import { ContentGenerator } from '../../src/content/ContentGenerator.js';
import { CourseEngine } from '../../src/engine/CourseEngine.js';
import type { ClaudeProvider } from '../../src/provider/ClaudeProvider.js';
import type { CurriculumPlan } from '../../src/curriculum/types.js';
import type { ContentItem, Question, StudentAnswer } from '../../src/content/types.js';
import type { ProviderResponse } from '../../src/provider/types.js';

// Import recorded fixtures
import * as mitFixtures from '../fixtures/recorded/mit-algorithms-lifecycle.js';
import * as cookingFixtures from '../fixtures/recorded/cooking-lifecycle.js';
import * as wwiiFixtures from '../fixtures/recorded/wwii-history-lifecycle.js';

// --- Helpers ---

function mockProvider(...responses: ProviderResponse[]): ClaudeProvider {
  const fn = vi.fn();
  for (const response of responses) {
    fn.mockResolvedValueOnce(response);
  }
  return { sendMessage: fn } as unknown as ClaudeProvider;
}

function buildCorrectAnswer(question: Question): StudentAnswer {
  switch (question.type) {
    case 'multiple-choice':
      return { type: 'multiple-choice', selectedIndex: question.correctIndex };
    case 'numeric-input':
      return { type: 'numeric-input', value: question.correctValue };
    case 'ordering':
      return { type: 'ordering', order: question.correctOrder };
    case 'multi-select':
      return { type: 'multi-select', selectedIndices: question.correctIndices };
    case 'two-stage':
      return {
        type: 'two-stage',
        selectedIndex: question.correctIndex,
        followUpSelectedIndex: question.followUpCorrectIndex,
      };
  }
}

function logPlan(label: string, plan: CurriculumPlan): void {
  console.log(`\n=== ${label} ===`);
  console.log(`Title: ${plan.title}`);
  console.log(`Sections: ${plan.sections.length}`);
  for (const section of plan.sections) {
    console.log(
      `  [${section.order}] ${section.title} (${section.topics.length} topics)`
    );
    for (const topic of section.topics) {
      console.log(`    - ${topic.title}`);
    }
  }
}

function logContent(label: string, items: ContentItem[]): void {
  console.log(`\n--- ${label}: ${items.length} items ---`);
  for (const item of items) {
    if (item.type === 'explanation') {
      console.log(`  [explanation] ${item.title} (${item.content.length} chars)`);
    } else {
      console.log(`  [${item.type}] ${item.question.slice(0, 80)}...`);
    }
  }
}

/**
 * Run a full lifecycle test: parse syllabus → generate content → walk engine.
 * Returns summary stats for assertions.
 */
async function runLifecycle(
  syllabusResponse: ProviderResponse,
  contentResponses: ProviderResponse[],
  label: string
): Promise<{
  plan: CurriculumPlan;
  items: ContentItem[];
  totalQuestions: number;
  finalState: string;
  masteryScores: Record<string, number>;
}> {
  // Step 1: Parse syllabus
  const syllabusProvider = mockProvider(syllabusResponse);
  const parser = new SyllabusParser(syllabusProvider);
  const plan = await parser.parse('(syllabus text)'); // text doesn't matter — response is mocked
  logPlan(label, plan);

  // Step 2: Create engine, load curriculum
  const engine = new CourseEngine({ apiKey: 'test-key' });
  engine.loadCurriculum(plan);
  expect(engine.state).toBe('ready');

  // Step 3: Start first section
  const firstSection = plan.sections[0];
  engine.startSection(firstSection.id);
  expect(engine.state).toBe('loading');

  // Step 4: Generate content for first section
  const contentProvider = mockProvider(...contentResponses);
  const contentGen = new ContentGenerator(contentProvider);
  const items = await contentGen.generateSection(firstSection, plan.title);
  logContent(`${label} — ${firstSection.title}`, items);

  // Step 5: Load content into engine
  engine.setSectionContent(items);
  expect(engine.state).toBe('practicing');

  // Step 6: Walk through all items, answering correctly
  let totalQuestions = 0;

  for (let i = 0; i < items.length; i++) {
    const item = engine.currentItem;
    expect(item).not.toBeNull();

    if (item!.type === 'explanation') {
      engine.nextItem();
    } else {
      const question = item as Question;
      const answer = buildCorrectAnswer(question);
      const result = engine.submitAnswer(answer);

      expect(result.correct).toBe(true);
      expect(result.questionId).toBe(question.id);
      totalQuestions++;

      engine.nextItem();
    }
  }

  // Collect mastery scores
  const studentState = engine.studentState;
  const masteryScores: Record<string, number> = {};
  for (const topic of firstSection.topics) {
    masteryScores[topic.id] = studentState.masteryByTopic[topic.id]?.score ?? 0;
  }

  return {
    plan,
    items,
    totalQuestions,
    finalState: engine.state,
    masteryScores,
  };
}

// --- Tests ---

describe('full engine lifecycle — MIT Algorithms', () => {
  it('parses syllabus into valid curriculum plan', async () => {
    const provider = mockProvider(mitFixtures.SYLLABUS_RESPONSE);
    const parser = new SyllabusParser(provider);
    const plan = await parser.parse('(mit syllabus)');

    expect(plan.title).toBe('Introduction to Algorithms');
    expect(plan.sections.length).toBe(3);
    expect(plan.sections[0].topics.length).toBe(2);

    // All IDs unique
    const topicIds = plan.sections.flatMap((s) => s.topics.map((t) => t.id));
    expect(new Set(topicIds).size).toBe(topicIds.length);
  });

  it('runs full lifecycle for first section', async () => {
    const result = await runLifecycle(
      mitFixtures.SYLLABUS_RESPONSE,
      [
        mitFixtures.EXPLANATION_COMPUTATIONAL_PROBLEMS,
        mitFixtures.QUIZ_COMPUTATIONAL_PROBLEMS,
        mitFixtures.EXPLANATION_PEAK_FINDING,
        mitFixtures.QUIZ_PEAK_FINDING,
      ],
      'MIT Algorithms'
    );

    expect(result.finalState).toBe('sectionComplete');
    expect(result.totalQuestions).toBe(6); // 3 + 3 questions
    expect(result.items.filter((i) => i.type === 'explanation').length).toBe(2);

    // Mastery increased for both topics
    expect(result.masteryScores['computational-problems']).toBeGreaterThan(0);
    expect(result.masteryScores['peak-finding']).toBeGreaterThan(0);
  });

  it('generates diverse question types', async () => {
    const result = await runLifecycle(
      mitFixtures.SYLLABUS_RESPONSE,
      [
        mitFixtures.EXPLANATION_COMPUTATIONAL_PROBLEMS,
        mitFixtures.QUIZ_COMPUTATIONAL_PROBLEMS,
        mitFixtures.EXPLANATION_PEAK_FINDING,
        mitFixtures.QUIZ_PEAK_FINDING,
      ],
      'MIT Algorithms (types)'
    );

    const questions = result.items.filter((i) => i.type !== 'explanation');
    const types = new Set(questions.map((q) => q.type));

    // Should have at least 3 different question types across both bursts
    expect(types.size).toBeGreaterThanOrEqual(3);
  });
});

describe('full engine lifecycle — Cooking', () => {
  it('parses informal syllabus correctly', async () => {
    const provider = mockProvider(cookingFixtures.SYLLABUS_RESPONSE);
    const parser = new SyllabusParser(provider);
    const plan = await parser.parse('(cooking syllabus)');

    expect(plan.title).toContain('Cook');
    expect(plan.sections.length).toBe(3);
  });

  it('runs full lifecycle for first section', async () => {
    const result = await runLifecycle(
      cookingFixtures.SYLLABUS_RESPONSE,
      [
        cookingFixtures.EXPLANATION_KNIFE_SKILLS,
        cookingFixtures.QUIZ_KNIFE_SKILLS,
        cookingFixtures.EXPLANATION_MISE_EN_PLACE,
        cookingFixtures.QUIZ_MISE_EN_PLACE,
      ],
      'Cooking'
    );

    expect(result.finalState).toBe('sectionComplete');
    expect(result.totalQuestions).toBe(6); // 3 + 3 questions
    expect(result.masteryScores['knife-skills']).toBeGreaterThan(0);
    expect(result.masteryScores['mise-en-place']).toBeGreaterThan(0);
  });
});

describe('full engine lifecycle — WWII History (non-CS)', () => {
  it('handles non-CS subject matter', async () => {
    const provider = mockProvider(wwiiFixtures.SYLLABUS_RESPONSE);
    const parser = new SyllabusParser(provider);
    const plan = await parser.parse('(wwii syllabus)');

    expect(plan.title).toContain('World War II');
    expect(plan.sections.length).toBe(3);
  });

  it('runs full lifecycle for first section', async () => {
    const result = await runLifecycle(
      wwiiFixtures.SYLLABUS_RESPONSE,
      [
        wwiiFixtures.EXPLANATION_VERSAILLES,
        wwiiFixtures.QUIZ_VERSAILLES,
        wwiiFixtures.EXPLANATION_FASCISM,
        wwiiFixtures.QUIZ_FASCISM,
      ],
      'WWII History'
    );

    expect(result.finalState).toBe('sectionComplete');
    expect(result.totalQuestions).toBe(7); // 4 + 3 questions
    expect(result.masteryScores['treaty-of-versailles']).toBeGreaterThan(0);
    expect(result.masteryScores['rise-of-fascism']).toBeGreaterThan(0);
  });

  it('correctly grades all question types including two-stage', async () => {
    const result = await runLifecycle(
      wwiiFixtures.SYLLABUS_RESPONSE,
      [
        wwiiFixtures.EXPLANATION_VERSAILLES,
        wwiiFixtures.QUIZ_VERSAILLES,
        wwiiFixtures.EXPLANATION_FASCISM,
        wwiiFixtures.QUIZ_FASCISM,
      ],
      'WWII History (grading)'
    );

    // WWII has two-stage, ordering, multi-select, numeric-input, and MCQ
    const questions = result.items.filter((i) => i.type !== 'explanation');
    const types = new Set(questions.map((q) => q.type));
    expect(types.has('two-stage')).toBe(true);
    expect(types.has('ordering')).toBe(true);
  });
});

describe('cross-cutting concerns', () => {
  it('unique question IDs across all topics within a section', async () => {
    const result = await runLifecycle(
      mitFixtures.SYLLABUS_RESPONSE,
      [
        mitFixtures.EXPLANATION_COMPUTATIONAL_PROBLEMS,
        mitFixtures.QUIZ_COMPUTATIONAL_PROBLEMS,
        mitFixtures.EXPLANATION_PEAK_FINDING,
        mitFixtures.QUIZ_PEAK_FINDING,
      ],
      'MIT (IDs)'
    );

    const questions = result.items.filter((i) => i.type !== 'explanation') as Question[];
    const ids = questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('question topicIds match the section topics', async () => {
    const result = await runLifecycle(
      cookingFixtures.SYLLABUS_RESPONSE,
      [
        cookingFixtures.EXPLANATION_KNIFE_SKILLS,
        cookingFixtures.QUIZ_KNIFE_SKILLS,
        cookingFixtures.EXPLANATION_MISE_EN_PLACE,
        cookingFixtures.QUIZ_MISE_EN_PLACE,
      ],
      'Cooking (topicIds)'
    );

    const sectionTopicIds = new Set(result.plan.sections[0].topics.map((t) => t.id));
    const questions = result.items.filter((i) => i.type !== 'explanation') as Question[];

    for (const q of questions) {
      expect(sectionTopicIds.has(q.topicId)).toBe(true);
    }
  });

  it('mastery score increases proportionally with correct answers', async () => {
    const result = await runLifecycle(
      mitFixtures.SYLLABUS_RESPONSE,
      [
        mitFixtures.EXPLANATION_COMPUTATIONAL_PROBLEMS,
        mitFixtures.QUIZ_COMPUTATIONAL_PROBLEMS,
        mitFixtures.EXPLANATION_PEAK_FINDING,
        mitFixtures.QUIZ_PEAK_FINDING,
      ],
      'MIT (mastery)'
    );

    // Each correct answer increases mastery by 0.15
    // 3 questions per topic = 0.45 expected mastery
    expect(result.masteryScores['computational-problems']).toBeCloseTo(0.45, 2);
    expect(result.masteryScores['peak-finding']).toBeCloseTo(0.45, 2);
  });
});
