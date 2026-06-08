/**
 * Secret redaction (spec §8.1/§8.5). Secrets must never land in events, the audit
 * log, or assembled prompts. This redacts by **key name** (anything that looks like
 * a credential field) and by **value shape** (provider key / bearer-token patterns),
 * recursively, returning a deep copy — the input is never mutated.
 */
export const REDACTED = "[REDACTED]";

// Field names whose values are secrets regardless of their content.
const SECRET_KEY = /(secret|token|api[-_]?key|password|passphrase|authorization|bearer)/i;

// Value shapes that are secrets regardless of their field name.
const SECRET_VALUE = /(sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+)/g;

export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(SECRET_VALUE, REDACTED);
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = SECRET_KEY.test(key) ? REDACTED : redact(v);
    }
    return out;
  }
  return value;
}
