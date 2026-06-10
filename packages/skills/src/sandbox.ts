/**
 * Sandbox: runs skill code in an isolated execution context.
 *
 * @todo implement resource limits and capability gating
 */
export interface SkillSandbox {
  run(code: string, context?: Record<string, unknown>): Promise<unknown>;
}

export function createSkillSandbox(): SkillSandbox {
  return {
    async run(_code: string, _context?: Record<string, unknown>): Promise<unknown> {
      throw new Error("Not implemented");
    },
  };
}
