// --- ContentCache ---
// In-memory storage for generated section content items.
// This allows the engine to retrieve content near-instantly if it
// has been prefetched in the background.

import { copyContentItem } from './copy-utils.js';
import type { ContentItem } from './types.js';

export class ContentCache {
  #cache = new Map<string, ContentItem[]>();

  /**
   * Set the content items for a specific section.
   */
  set(sectionId: string, items: ContentItem[]): void {
    this.#cache.set(sectionId, items.map(copyContentItem));
  }

  /**
   * Retrieve the content items for a section.
   */
  get(sectionId: string): ContentItem[] | undefined {
    const items = this.#cache.get(sectionId);
    return items?.map(copyContentItem);
  }

  /**
   * Check if a section's content is already cached.
   */
  has(sectionId: string): boolean {
    return this.#cache.has(sectionId);
  }

  /**
   * Clear the cache.
   */
  clear(): void {
    this.#cache.clear();
  }
}
