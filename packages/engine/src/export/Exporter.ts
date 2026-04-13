import type { EngineSnapshot } from '../engine/types.js';

export interface ExportBundle {
  type: 'coursequizzer-export';
  version: number;
  timestamp: string;
  data: EngineSnapshot;
}

/**
 * Handles exporting course data into a portable JSON bundle.
 */
export class Exporter {
  /**
   * Creates an export bundle from an engine snapshot.
   * Ensure no sensitive data (like API keys) is in the snapshot before calling.
   */
  export(snapshot: EngineSnapshot): ExportBundle {
    return {
      type: 'coursequizzer-export',
      version: 1,
      timestamp: new Date().toISOString(),
      data: { ...snapshot },
    };
  }

  /**
   * Convenience method to export as a JSON string.
   */
  exportToString(snapshot: EngineSnapshot): string {
    return JSON.stringify(this.export(snapshot), null, 2);
  }
}
