// --- Content Copy Utilities ---
// Defensive copies keep generated content immutable across engine boundaries.

import type { ContentItem } from './types.js';

export function copyContentItem(item: ContentItem): ContentItem {
  switch (item.type) {
    case 'explanation':
      return { ...item };
    case 'multiple-choice':
      return { ...item, options: [...item.options] };
    case 'numeric-input':
      return { ...item };
    case 'ordering':
      return {
        ...item,
        items: [...item.items],
        correctOrder: [...item.correctOrder],
      };
    case 'multi-select':
      return {
        ...item,
        options: [...item.options],
        correctIndices: [...item.correctIndices],
      };
    case 'two-stage':
      return {
        ...item,
        options: [...item.options],
        followUpOptions: [...item.followUpOptions],
      };
    case 'checklist':
      return {
        ...item,
        items: [...item.items],
      };
    case 'code': {
      const copy: ContentItem = {
        type: item.type,
        id: item.id,
        topicId: item.topicId,
        question: item.question,
        language: item.language,
      };
      if (item.initialCode !== undefined) copy.initialCode = item.initialCode;
      return copy;
    }
    case 'self-evaluation':
      return {
        ...item,
        options: [...item.options],
      };
    default: {
      const exhaustive: never = item;
      throw new Error('Unsupported content item type');
    }
  }
}
