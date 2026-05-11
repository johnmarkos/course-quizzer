import { describe, it, expect, vi } from 'vitest';
import {
  ContentManager,
  type ApiCallEventHandler,
} from '../src/content/ContentManager.js';
import { StudentModel } from '../src/student/StudentModel.js';
import type { ContentGenerator } from '../src/content/ContentGenerator.js';
import type { Section, Topic } from '../src/curriculum/types.js';

describe('ContentManager', () => {
  const TOPIC: Topic = { id: 't1', title: 'Topic 1', description: 'Desc 1' };
  const SECTION: Section = { id: 's1', title: 'Section 1', order: 0, topics: [TOPIC] };
  type ApiCallEvent = Parameters<ApiCallEventHandler>[0];

  it('orchestrates generation and emits events', async () => {
    const generator = {
      generateTopicExplanation: vi.fn().mockResolvedValue({
        type: 'explanation',
        topicId: 't1',
        title: 'Exp',
        content: 'Content',
      }),
      generateTopicQuizBurst: vi.fn().mockResolvedValue([
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

    const events: ApiCallEvent[] = [];
    const onApiCall: ApiCallEventHandler = (payload) => events.push(payload);

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
      id: 'api-call-1',
      purpose: 'Explanation for topic: Topic 1',
      status: 'start',
    });
    expect(events[1].status).toBe('complete');
    expect(events[2].purpose).toContain('Quiz');
    expect(events[2].status).toBe('start');
  });

  it('emits matching ids for each start and complete event pair', async () => {
    const generator = {
      generateTopicExplanation: vi.fn().mockResolvedValue({
        type: 'explanation',
        topicId: 't1',
        title: 'Exp',
        content: 'Content',
      }),
      generateTopicQuizBurst: vi.fn().mockResolvedValue([]),
    } as unknown as ContentGenerator;

    const events: ApiCallEvent[] = [];
    const onApiCall: ApiCallEventHandler = (payload) => events.push(payload);

    const manager = new ContentManager(generator, onApiCall);
    await manager.generateSection(SECTION, 'Course');

    const eventsById = new Map<string, ApiCallEvent[]>();
    for (const event of events) {
      eventsById.set(event.id, [...(eventsById.get(event.id) ?? []), event]);
    }

    expect(eventsById.size).toBe(2);
    for (const relatedEvents of eventsById.values()) {
      expect(relatedEvents).toHaveLength(2);
      expect(relatedEvents.map((event) => event.status).sort()).toEqual([
        'complete',
        'start',
      ]);
      expect(new Set(relatedEvents.map((event) => event.purpose)).size).toBe(1);
    }
  });

  it('passes adaptive question counts into quiz generation', async () => {
    const generator = {
      generateTopicExplanation: vi.fn().mockResolvedValue({
        type: 'explanation',
        topicId: 't1',
        title: 'Exp',
        content: 'Content',
      }),
      generateTopicQuizBurst: vi.fn().mockResolvedValue([]),
    } as unknown as ContentGenerator;

    const studentModel = new StudentModel({
      masteryByTopic: {
        t1: {
          topicId: 't1',
          score: 0.9,
          questionsAnswered: 6,
          questionsCorrect: 6,
        },
      },
      gaps: [],
    });

    const manager = new ContentManager(generator, () => {});
    await manager.generateSection(SECTION, 'Course', studentModel);

    expect(generator.generateTopicQuizBurst).toHaveBeenCalledWith(
      TOPIC,
      'Course',
      'Section 1',
      'Content',
      2
    );
  });

  it('emits complete event even if generation fails', async () => {
    const generator = {
      generateTopicExplanation: vi.fn().mockRejectedValue(new Error('API Failure')),
    } as unknown as ContentGenerator;

    const events: ApiCallEvent[] = [];
    const onApiCall: ApiCallEventHandler = (payload) => events.push(payload);

    const manager = new ContentManager(generator, onApiCall);
    await expect(manager.generateSection(SECTION, 'Course')).rejects.toThrow(
      'API Failure'
    );

    expect(events).toHaveLength(2);
    expect(events[0].status).toBe('start');
    expect(events[1].status).toBe('complete');
    expect(events[1].id).toBe(events[0].id);
  });
});
