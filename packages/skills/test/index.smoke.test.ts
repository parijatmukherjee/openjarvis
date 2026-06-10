import { describe, it, expect } from "vitest";
import * as skills from "../src/index.js";

describe("@openjarvis/skills public surface", () => {
  it("re-exports the skill system building blocks", () => {
    const expected = ["createSkillManifest", "createSkillLoader", "createSkillSandbox"] as const;
    for (const name of expected) {
      expect(skills, `missing export: ${name}`).toHaveProperty(name);
    }
  });
});
