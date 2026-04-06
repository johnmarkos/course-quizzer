// --- Event System ---
// Typed event emitter for engine-to-UI communication.
// The engine emits events with all data the UI needs to render.
// The UI never reaches back into the engine for display info.

export type EngineEventMap = {
  ready: { state: string };
  stateChange: { from: string; to: string };
  error: { message: string };
};

export type EngineEvent = keyof EngineEventMap;
export type Listener<E extends EngineEvent> = (payload: EngineEventMap[E]) => void;

type ListenerEntry = {
  event: EngineEvent;
  listener: Listener<never>;
};

export class EventEmitter {
  #listeners: ListenerEntry[] = [];

  on<E extends EngineEvent>(event: E, listener: Listener<E>): void {
    this.#listeners.push({
      event,
      listener: listener as Listener<never>,
    });
  }

  off<E extends EngineEvent>(event: E, listener: Listener<E>): void {
    this.#listeners = this.#listeners.filter(
      (entry) => !(entry.event === event && entry.listener === listener)
    );
  }

  protected emit<E extends EngineEvent>(event: E, payload: EngineEventMap[E]): void {
    for (const entry of this.#listeners) {
      if (entry.event === event) {
        (entry.listener as Listener<E>)(payload);
      }
    }
  }
}
