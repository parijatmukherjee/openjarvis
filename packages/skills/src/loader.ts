/**
 * Loader: discovers and loads skill modules from the file-system.
 *
 * @todo implement resolution, caching, and hot-reload
 */
export interface SkillLoader {
  load(name: string): Promise<unknown>;
  list(): Promise<string[]>;
}

export function createSkillLoader(): SkillLoader {
  return {
    async load(_name: string): Promise<unknown> {
      throw new Error("Not implemented");
    },
    async list(): Promise<string[]> {
      return [];
    },
  };
}
