// --- Engine Types ---

export type EngineState = 'idle' | 'ready';

export type EngineSnapshot = {
  version: number;
  state: EngineState;
};

export type CourseEngineConfig = {
  apiKey: string;
  model?: string;
};
