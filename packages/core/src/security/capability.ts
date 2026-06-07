/** The Lab — least-privilege capability model. Default-deny. */
export type CapabilityName =
  | "shell"
  | "network"
  | "fs:read"
  | "fs:write"
  | "host:info"
  | "model-call";

export interface Capability {
  name: CapabilityName;
  /** Optional fine-grained scope (e.g. a path prefix). Omitted = broad. */
  scope?: string;
}

export interface AgentGrant {
  agentId: string;
  capabilities: Capability[];
}

/**
 * Does `grant` satisfy `required`? A capability matches when names are equal and
 * either side's scope is broad (undefined) or the scopes are equal. Default-deny:
 * no matching capability => false.
 */
export function grantSatisfies(grant: AgentGrant, required: Capability): boolean {
  return grant.capabilities.some(
    (c) =>
      c.name === required.name &&
      (c.scope === undefined || required.scope === undefined || c.scope === required.scope),
  );
}
