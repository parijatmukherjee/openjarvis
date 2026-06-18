import { z } from "zod";
import type { ToolDefinition } from "@openjarvis/core";
import type { ToolRegistry } from "@openjarvis/core";
import { OpClient } from "./op-client.js";
import type { OpClientConfig } from "./op-client.js";

const SecretsGetArgs = z.object({
  reference: z.string().startsWith("op://"),
});

const SecretsGetResult = z.object({
  value: z.string(),
});

type SecretsGetArgs = z.infer<typeof SecretsGetArgs>;
type SecretsGetResult = z.infer<typeof SecretsGetResult>;

export function createSecretsGetTool(
  opClient: OpClient,
): ToolDefinition<SecretsGetArgs, SecretsGetResult> {
  return {
    name: "secrets_get",
    description: "Retrieve a secret from 1Password by reference",
    args: SecretsGetArgs as unknown as z.ZodType<SecretsGetArgs>,
    result: SecretsGetResult as unknown as z.ZodType<SecretsGetResult>,
    capabilities: [{ name: "secrets:read" as const }],
    handler: async (args: SecretsGetArgs): Promise<SecretsGetResult> => {
      const value = await opClient.read(args.reference);
      return { value };
    },
  };
}

export function registerSecretsTools(
  registry: ToolRegistry,
  config: OpClientConfig = {},
): void {
  const opClient = new OpClient(config);
  registry.register(createSecretsGetTool(opClient));
}