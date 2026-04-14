// --- Prefetcher Tests ---

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CourseEngine } from '../src/engine/CourseEngine.js';
import { ContentGenerator } from '../src/content/ContentGenerator.js';
import { ContentCache } from '../src/content/ContentCache.js';
import { Prefetcher } from '../src/content/Prefetcher.js';
import type { ClaudeProvider } from '../src/provider/ClaudeProvider.js';
import type { CurriculumPlan } from '../src/curriculum/types.js';
import type { ContentItem } from '../src/content/types.js';

// --- Mocks & Fixtures ---

const MOCK_PLAN: CurriculumPlan = {
  title: 'Test Course',
  sections: [
    {
      id: 's1',
      title: 'Section 1',
      order: 0,
      topics: [{ id: 't1', title: 'Topic 1', description: 'Desc 1' }],
    },
    {
      id: 's2',
      title: 'Section 2',
      order: 1,
      topics: [{ id: 't2', title: 'Topic 2', description: 'Desc 2' }],
    },
    {
      id: 's3',
      title: 'Section 3',
      order: 2,
      topics: [{ id: 't3', title: 'Topic 3', description: 'Desc 3' }],
    },
  ],
};

const MOCK_EXPLANATION_T2: ContentItem = {
  type: 'explanation',
  topicId: 't2',
  title: 'Exp 2',
  content: 'Content 2',
};

const MOCK_QUESTIONS_T2: ContentItem[] = [
  {
    type: 'multiple-choice',
    id: 'q2',
    topicId: 't2',
    question: 'Q2',
    options: ['O1', 'O2'],
    correctIndex: 0,
  },
];

const MOCK_ITEMS_S2: ContentItem[] = [MOCK_EXPLANATION_T2, ...MOCK_QUESTIONS_T2];

function mockProvider(): ClaudeProvider {
  return { sendMessage: vi.fn() } as unknown as ClaudeProvider;
}

function mockGenerator(generator: ContentGenerator) {
  vi.spyOn(generator, 'generateTopicExplanation').mockResolvedValue(
    MOCK_EXPLANATION_T2 as any
  );
  vi.spyOn(generator, 'generateTopicQuizBurst').mockResolvedValue(
    MOCK_QUESTIONS_T2 as any
  );
}

describe('ContentCache', () => {
  it('stores and retrieves content items', () => {
    const cache = new ContentCache();
    const items: ContentItem[] = [
      { type: 'explanation', topicId: 't1', title: 'T1', content: 'C1' },
    ];

    cache.set('s1', items);
    expect(cache.has('s1')).toBe(true);
    expect(cache.get('s1')).toEqual(items);
    expect(cache.has('s2')).toBe(false);
  });

  it('clears the cache', () => {
    const cache = new ContentCache();
    cache.set('s1', []);
    cache.clear();
    expect(cache.has('s1')).toBe(false);
  });

  it('defensively copies cached items on set and get', () => {
    const cache = new ContentCache();
    const sourceItems: ContentItem[] = [
      {
        type: 'multiple-choice',
        id: 'q1',
        topicId: 't1',
        question: 'Original question',
        options: ['A', 'B'],
        correctIndex: 0,
      },
    ];

    cache.set('s1', sourceItems);

    sourceItems[0].question = 'Mutated source question';
    sourceItems[0].options[0] = 'Mutated source option';

    const firstRead = cache.get('s1');
    expect(firstRead).toEqual([
      {
        type: 'multiple-choice',
        id: 'q1',
        topicId: 't1',
        question: 'Original question',
        options: ['A', 'B'],
        correctIndex: 0,
      },
    ]);

    firstRead![0].question = 'Mutated cached question';
    firstRead![0].options[0] = 'Mutated cached option';

    expect(cache.get('s1')).toEqual([
      {
        type: 'multiple-choice',
        id: 'q1',
        topicId: 't1',
        question: 'Original question',
        options: ['A', 'B'],
        correctIndex: 0,
      },
    ]);
  });
});

describe('Prefetcher', () => {
  it('prefetches the next section and stores it in the cache', async () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);
    const cache = new ContentCache();
    const prefetcher = new Prefetcher(generator, cache);

    prefetcher.setCurriculum(MOCK_PLAN);

    // Mock generator methods
    mockGenerator(generator);

    await prefetcher.prefetch(0); // Prefetch section at index 1 (s2)

    expect(cache.has('s2')).toBe(true);
    expect(cache.get('s2')).toEqual(MOCK_ITEMS_S2);
  });

  it('does nothing if next section is already in cache', async () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);
    const expSpy = vi.spyOn(generator, 'generateTopicExplanation');

    const cache = new ContentCache();
    cache.set('s2', []);
    const prefetcher = new Prefetcher(generator, cache);
    prefetcher.setCurriculum(MOCK_PLAN);

    await prefetcher.prefetch(0);

    expect(expSpy).not.toHaveBeenCalled();
  });

  it('does nothing if at the last section', async () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);
    const expSpy = vi.spyOn(generator, 'generateTopicExplanation');

    const cache = new ContentCache();
    const prefetcher = new Prefetcher(generator, cache);
    prefetcher.setCurriculum(MOCK_PLAN);

    await prefetcher.prefetch(2); // Last index

    expect(expSpy).not.toHaveBeenCalled();
  });
});

describe('CourseEngine + Prefetcher integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses cached content if available in startSection', async () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);
    const engine = new CourseEngine({
      apiKey: 'test',
      generator,
      prefetch: { enabled: true },
    });

    engine.loadCurriculum(MOCK_PLAN);

    // Manually prime the cache for section 2
    // We need to get a reference to the cache. Since it's private,
    // we have to rely on the prefetcher to fill it or expose it for tests.
    // In this case, we'll let startSection(s1) trigger prefetch for s2.

    mockGenerator(generator);

    // Start s1
    engine.startSection('s1');
    expect(engine.state).toBe('loading');

    // Load s1 content
    engine.setSectionContent([
      { type: 'explanation', topicId: 't1', title: 'Exp 1', content: 'C1' },
    ]);
    expect(engine.state).toBe('practicing');

    // Complete s1
    engine.nextItem();
    expect(engine.state).toBe('sectionComplete');

    // Wait for prefetch of s2 to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Now start s2
    const contentReadySpy = vi.fn();
    engine.on('contentReady', contentReadySpy);

    engine.startSection('s2');

    // Should have transitioned through loading to practicing immediately
    expect(engine.state).toBe('practicing');
    expect(contentReadySpy).toHaveBeenCalled();
    expect(engine.currentItem).toEqual(MOCK_ITEMS_S2[0]);
  });

  it('triggers prefetch on startSection', async () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);

    const expSpy = vi
      .spyOn(generator, 'generateTopicExplanation')
      .mockImplementation(async (topic) => ({
        type: 'explanation',
        topicId: topic.id,
        title: `Explanation for ${topic.id}`,
        content: `Content for ${topic.id}`,
      }));
    vi.spyOn(generator, 'generateTopicQuizBurst').mockResolvedValue(
      MOCK_QUESTIONS_T2 as any
    );

    const engine = new CourseEngine({
      apiKey: 'test',
      generator,
      prefetch: { enabled: true },
    });

    engine.loadCurriculum(MOCK_PLAN);
    engine.startSection('s1');

    // Wait for fire-and-forget prefetch
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(expSpy).toHaveBeenCalledTimes(2);
    expect(expSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 't1' }),
      'Test Course',
      'Section 1'
    );
    expect(expSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 't2' }),
      'Test Course',
      'Section 2'
    );
  });

  it('handles prefetch failure gracefully without affecting engine state', async () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);

    vi.spyOn(generator, 'generateTopicExplanation').mockImplementation(async (topic) => {
      if (topic.id === 't2') {
        throw new Error('LLM error');
      }

      return {
        type: 'explanation',
        topicId: topic.id,
        title: `Explanation for ${topic.id}`,
        content: `Content for ${topic.id}`,
      };
    });
    vi.spyOn(generator, 'generateTopicQuizBurst').mockResolvedValue(
      MOCK_QUESTIONS_T2 as any
    );

    const engine = new CourseEngine({
      apiKey: 'test',
      generator,
      prefetch: { enabled: true },
    });

    engine.loadCurriculum(MOCK_PLAN);

    // This should not throw
    engine.startSection('s1');

    // Wait for fire-and-forget prefetch to fail
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(engine.state).toBe('practicing');
    expect(engine.currentItem).toEqual({
      type: 'explanation',
      topicId: 't1',
      title: 'Explanation for t1',
      content: 'Content for t1',
    });

    // Complete s1
    engine.nextItem(); // Moves from Exp 0 to Question 1
    engine.submitAnswer({ type: 'multiple-choice', selectedIndex: 0 }); // State: answered
    engine.nextItem(); // Moves from Question 1 to 2. >= length 2. Calls #completeSection()
    expect(engine.state).toBe('sectionComplete');

    engine.startSection('s2');
    expect(engine.state).toBe('loading');
    expect(engine.currentItem).toBeNull();
  });

  it('does not allow prefetch to interrupt active section generation', async () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);

    const callOrder: string[] = [];

    vi.spyOn(generator, 'generateTopicExplanation').mockImplementation(async (topic) => {
      callOrder.push(`exp:${topic.id}`);
      return {
        type: 'explanation',
        topicId: topic.id,
        title: `Exp ${topic.id}`,
        content: `Content ${topic.id}`,
      };
    });

    vi.spyOn(generator, 'generateTopicQuizBurst').mockImplementation(async (topic) => {
      callOrder.push(`quiz:${topic.id}`);
      return [
        {
          type: 'multiple-choice',
          id: `q-${topic.id}`,
          topicId: topic.id,
          question: `Q ${topic.id}`,
          options: ['A', 'B'],
          correctIndex: 0,
        },
      ];
    });

    const engine = new CourseEngine({
      apiKey: 'test',
      generator,
      prefetch: { enabled: true },
    });

    engine.loadCurriculum(MOCK_PLAN);

    // Start s1. This should trigger generation for s1 (t1) and then prefetch for s2 (t2).
    engine.startSection('s1');

    // Wait for everything to settle
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The order should be:
    // 1. Section 1 Explanation (t1)
    // 2. Section 1 Quiz (t1)
    // 3. Section 2 Explanation (t2) -- prefetched
    // 4. Section 2 Quiz (t2) -- prefetched
    expect(callOrder).toEqual(['exp:t1', 'quiz:t1', 'exp:t2', 'quiz:t2']);
  });
});
