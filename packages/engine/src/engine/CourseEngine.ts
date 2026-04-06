// --- CourseEngine ---
// Central orchestrator for adaptive course content generation.
// Manages the lifecycle from syllabus input through content generation
// and student interaction. Emits events for all state changes —
// the UI consumes these events and never reaches back into the engine.

import { EventEmitter } from './events.js';
import type { CourseEngineConfig, EngineSnapshot, EngineState } from './types.js';

const SNAPSHOT_VERSION = 1;

export class CourseEngine extends EventEmitter {
  #state: EngineState = 'idle';
  #config: CourseEngineConfig;
  constructor(config: CourseEngineConfig) {
    super();
    this.#config = { ...config };
    this.#setState('ready');
  }

  // --- State ---

  get state(): EngineState {
    return this.#state;
  }

  #setState(newState: EngineState): void {
    const from = this.#state;
    this.#state = newState;
    this.emit('stateChange', { from, to: newState });

    if (newState === 'ready') {
      this.emit('ready', { state: newState });
    }
  }

  // --- Persistence ---

  serialize(): EngineSnapshot {
    return {
      version: SNAPSHOT_VERSION,
      state: this.#state,
    };
  }

  static restore(snapshot: EngineSnapshot, config: CourseEngineConfig): CourseEngine {
    if (snapshot.version !== SNAPSHOT_VERSION) {
      throw new Error(
        `Unsupported snapshot version: ${snapshot.version} (expected ${SNAPSHOT_VERSION})`
      );
    }

    // Constructor fires events, but no listeners are registered yet,
    // so they go nowhere. We overwrite state to match the snapshot.
    // Restore does NOT emit events — the consumer must resync explicitly.
    const engine = new CourseEngine(config);
    engine.#state = snapshot.state;
    return engine;
  }
}
