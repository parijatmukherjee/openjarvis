import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";

/**
 * Convert a Zod schema to a JSON Schema (draft-7) object suitable for handing to
 * a model provider as a native tool/function definition (used by the S1.4 model
 * adapters). `$refStrategy: "none"` keeps the schema inline (no `$ref`), which the
 * provider tool-calling APIs expect.
 *
 * NOTE: zod-to-json-schema@3 always emits a top-level `$schema` metadata key with
 * no opt-out. Some provider tool-calling validators reject unknown top-level keys,
 * so the S1.4 adapter layer should strip `$schema` before sending.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return zodToJsonSchema(schema, { target: "jsonSchema7", $refStrategy: "none" }) as Record<
    string,
    unknown
  >;
}
