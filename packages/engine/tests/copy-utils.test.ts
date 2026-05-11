// --- Copy Utils Tests ---
// Shared content-copy behavior is used by both ContentCache and CourseEngine.

import { describe, expect, it } from 'vitest';
import { copyContentItem } from '../src/content/copy-utils.js';
import type { ContentItem } from '../src/content/types.js';

const CONTENT_ITEMS: ContentItem[] = [
  {
    type: 'explanation',
    topicId: 'topic-1',
    title: 'Intro',
    content: 'A short explanation.',
  },
  {
    type: 'multiple-choice',
    id: 'q-mc',
    topicId: 'topic-1',
    question: 'Pick one.',
    options: ['A', 'B'],
    correctIndex: 0,
  },
  {
    type: 'numeric-input',
    id: 'q-num',
    topicId: 'topic-1',
    question: 'What is 2+2?',
    correctValue: 4,
    tolerance: 0,
    unit: 'units',
  },
  {
    type: 'ordering',
    id: 'q-order',
    topicId: 'topic-1',
    question: 'Sort these.',
    items: ['First', 'Second'],
    correctOrder: [0, 1],
  },
  {
    type: 'multi-select',
    id: 'q-ms',
    topicId: 'topic-1',
    question: 'Pick all that apply.',
    options: ['A', 'B', 'C'],
    correctIndices: [0, 2],
  },
  {
    type: 'two-stage',
    id: 'q-ts',
    topicId: 'topic-1',
    question: 'Stage one?',
    options: ['Yes', 'No'],
    correctIndex: 0,
    followUp: 'Why?',
    followUpOptions: ['Because', 'Otherwise'],
    followUpCorrectIndex: 0,
  },
  {
    type: 'checklist',
    id: 'q-check',
    topicId: 'topic-1',
    question: 'Complete the steps.',
    items: ['Step one', 'Step two'],
  },
  {
    type: 'code',
    id: 'q-code',
    topicId: 'topic-1',
    question: 'Write a function.',
    language: 'javascript',
    initialCode: 'function answer() {}',
    expectedPattern: 'return',
  },
  {
    type: 'self-evaluation',
    id: 'q-self',
    topicId: 'topic-1',
    question: 'How confident are you?',
    options: ['Need practice', 'Got it'],
  },
];

describe('copyContentItem', () => {
  it.each(CONTENT_ITEMS.map((item) => [item.type, item] as const))(
    'copies %s content items',
    (_type, item) => {
      const copy = copyContentItem(item);

      expect(copy).toEqual(item);
      expect(copy).not.toBe(item);
    }
  );

  it('copies array fields defensively', () => {
    const itemsWithArrays = CONTENT_ITEMS.filter((item) =>
      Object.values(item).some(Array.isArray)
    );

    for (const item of itemsWithArrays) {
      const original = structuredClone(item) as ContentItem;
      const copy = copyContentItem(item) as Record<string, unknown>;

      for (const value of Object.values(copy)) {
        if (Array.isArray(value)) {
          value.push('mutated');
        }
      }

      expect(item).toEqual(original);
    }
  });
});
