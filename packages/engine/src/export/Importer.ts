import type { ExportBundle } from './Exporter.js';
import type { EngineSnapshot } from '../engine/types.js';
import { validateCurriculumPlan } from '../curriculum/SyllabusParser.js';
import { validateEngineSnapshot } from './snapshot-validation.js';

/**
 * Handles importing course data from a portable JSON bundle.
 * Validates the bundle structure and version compatibility.
 */
export class Importer {
  /**
   * Validates that the provided object is a valid ExportBundle.
   * Throws an error if validation fails.
   */
  validate(bundle: unknown): ExportBundle {
    if (typeof bundle !== 'object' || bundle === null) {
      throw new Error('Import data must be a JSON object');
    }

    const b = bundle as Partial<ExportBundle>;

    if (b.type !== 'coursequizzer-export') {
      throw new Error('Invalid export bundle type');
    }

    if (typeof b.version !== 'number' || b.version < 1) {
      throw new Error('Unsupported or missing export bundle version');
    }

    if (!b.data || typeof b.data !== 'object') {
      throw new Error('Missing or malformed data in export bundle');
    }

    const snapshot = validateEngineSnapshot(b.data);
    if (!snapshot) {
      throw new Error('Invalid engine snapshot in export bundle');
    }

    // Deeper validation of curriculum
    if (!snapshot.curriculum) {
      throw new Error('Cannot import an incomplete course (no curriculum found)');
    }

    try {
      validateCurriculumPlan(snapshot.curriculum);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid curriculum in export bundle: ${message}`);
    }

    return {
      ...b,
      data: snapshot,
    } as ExportBundle;
  }

  /**
   * Parses and validates a JSON string as an ExportBundle,
   * returning the contained EngineSnapshot.
   */
  import(bundleString: string): EngineSnapshot {
    try {
      const parsed = JSON.parse(bundleString);
      const validated = this.validate(parsed);
      return validated.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Import failed: ${message}`);
    }
  }
}
