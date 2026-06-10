/**
 * Manifest: describes the metadata and public interface of a skill.
 *
 * @todo flesh out schema, validation, and discovery
 */
export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  exports: string[];
}

export function createSkillManifest(partial?: Partial<SkillManifest>): SkillManifest {
  return {
    name: partial?.name ?? "",
    version: partial?.version ?? "0.0.0",
    description: partial?.description ?? "",
    exports: partial?.exports ?? [],
  };
}
