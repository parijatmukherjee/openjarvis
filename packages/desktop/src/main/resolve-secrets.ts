export interface ResolveSecretsOptions {
  graceful?: boolean;
}

export interface OpClient {
  read(reference: string): Promise<string>;
}

export async function resolveSecrets<T>(
  config: T,
  opClient: OpClient,
  options: ResolveSecretsOptions = {},
): Promise<T> {
  return resolveValue(config, opClient, options) as Promise<T>;
}

async function resolveValue(
  value: unknown,
  opClient: OpClient,
  options: ResolveSecretsOptions,
): Promise<unknown> {
  if (typeof value === "string" && value.startsWith("op://")) {
    try {
      return await opClient.read(value);
    } catch {
      if (options.graceful) {
        return value;
      }
      throw new Error(`Failed to resolve secret: ${value}`);
    }
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => resolveValue(item, opClient, options)));
  }

  if (value !== null && typeof value === "object") {
    const resolved: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);
    await Promise.all(
      entries.map(async ([key, val]) => {
        resolved[key] = await resolveValue(val, opClient, options);
      }),
    );
    return resolved;
  }

  return value;
}
