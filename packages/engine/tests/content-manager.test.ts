import { describe, it, expect, vi } from 'vitest';
import { ContentManager } from '../src/content/ContentManager.js';
import type { ContentGenerator } from '../src/content/ContentGenerator.js';
import type { Section, Topic } from '../src/curriculum/types.js';

describe('ContentManager', () => {
  const TOPIC: Topic = { id: 't1', title: 'Topic 1', description: 'Desc 1' };
  const SECTION: Section = { id: 's1', title: 'Section 1', order: 0, topics: [TOPIC] };

  it('orchestrates generation and emits events', async () => {
    const generator = {
      generateTopicExplanation: vi.fn().mockResolvedValue({
        type: 'explanation',
        topicId: 't1',
        title: 'Exp',
        content: 'Content',
      }),
      generateTopicQuizBurst: vi
        .fn()
        .mockResolvedValue([
          {
            type: 'multiple-choice',
            id: 'q1',
            topicId: 't1',
            question: 'Q?',
            options: ['A'],
            correctIndex: 0,
          },
        ]),
    } as unknown as ContentGenerator;

    const events: any[] = [];
    const onApiCall = (payload: any) => events.push(payload);

    const manager = new ContentManager(generator, onApiCall);
    const items = await manager.generateSection(SECTION, 'Course');

    expect(items).toHaveLength(2);
    expect(generator.generateTopicExplanation).toHaveBeenCalledWith(
      TOPIC,
      'Course',
      'Section 1'
    );
    expect(generator.generateTopicQuizBurst).toHaveBeenCalled();

    expect(events).toHaveLength(4); // Start/Complete for explanation, Start/Complete for quiz
    expect(events[0]).toEqual({
      purpose: 'Explanation for topic: Topic 1',
      status: 'start',
    });
    expect(events[1].status).toBe('complete');
    expect(events[2].purpose).toContain('Quiz');
    expect(events[2].status).toBe('start');
  });

  it('emits complete event even if generation fails', async () => {
    const generator = {
      generateTopicExplanation: vi.fn().mockRejectedValue(new Error('API Failure')),
    } as unknown as ContentGenerator;

    const events: any[] = [];
    const onApiCall = (payload: any) => events.push(payload);

    const manager = new ContentManager(generator, onApiCall);
    await expect(manager.generateSection(SECTION, 'Course')).rejects.toThrow(
      'API Failure'
    );

    expect(events).toHaveLength(2);
    expect(events[0].status).toBe('start');
    expect(events[1].status).toBe('complete');
  });
});
