// --- Engine Errors ---

export class InvalidTransitionError extends Error {
  constructor(action: string, currentState: string) {
    super(`Cannot ${action} in state "${currentState}"`);
    this.name = 'InvalidTransitionError';
  }
}

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}
