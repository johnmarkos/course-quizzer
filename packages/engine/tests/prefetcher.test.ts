// --- Prefetcher Tests ---

import { describe, it, expect, vi } from 'vitest';
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
  it('uses cached content if available in startSection', async () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);
    const engine = new CourseEngine({
      apiKey: 'test',
      prefetch: { enabled: true, generator },
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
    await new Promise((resolve) => setTimeout(resolve, 50));

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

    // Mock generator methods
    const expSpy = vi
      .spyOn(generator, 'generateTopicExplanation')
      .mockResolvedValue(MOCK_EXPLANATION_T2 as any);
    vi.spyOn(generator, 'generateTopicQuizBurst').mockResolvedValue(
      MOCK_QUESTIONS_T2 as any
    );

    const engine = new CourseEngine({
      apiKey: 'test',
      prefetch: { enabled: true, generator },
    });

    engine.loadCurriculum(MOCK_PLAN);
    engine.startSection('s1');

    // Wait for fire-and-forget prefetch
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(expSpy).toHaveBeenCalled();
  });

  it('handles prefetch failure gracefully without affecting engine state', async () => {
    const provider = mockProvider();
    const generator = new ContentGenerator(provider);

    // Force prefetch to fail
    vi.spyOn(generator, 'generateTopicExplanation').mockRejectedValue(
      new Error('LLM error')
    );

    const engine = new CourseEngine({
      apiKey: 'test',
      prefetch: { enabled: true, generator },
    });

    engine.loadCurriculum(MOCK_PLAN);

    // This should not throw
    engine.startSection('s1');

    // Wait for fire-and-forget prefetch to fail
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(engine.state).toBe('loading');

    // Now startSection(s2) should work normally and transition to loading
    engine.setSectionContent([
      { type: 'explanation', topicId: 't1', title: 'E1', content: 'C1' },
    ]);
    engine.nextItem(); // complete s1

    engine.startSection('s2');
    expect(engine.state).toBe('loading');
    expect(engine.currentItem).toBeNull();
  });
});
