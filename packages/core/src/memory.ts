/**
 * Minimal memory-store interface injected into the agent loop.
 * `core` does not depend on `@openjarvis/memory`; the composition root
 * injects a concrete implementation (e.g. JarvisMemoryStore's `MemoryStore`).
 */
export interface MemoryStore {
  /** Return top-k relevant text fragments for the given query. */
  recall(query: string, k?: number): Promise<string[]>;
}
