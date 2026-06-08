import { z } from "zod";
import type { ToolCallRecord } from "../loop/turn.js";

/**
 * Claim-citation verification (spec §6.3). For the strongest grounding mode the
 * model emits its answer as claims, each citing the id of a tool result that
 * supports it. The verifier checks every citation exists and — where the claim
 * carries a numeric value — that the value actually appears in that tool result.
 * S1 does numeric + existence checks; cheap-model entailment is deferred (§12.2).
 */
export const claimSchema = z.object({
  statement: z.string().min(1),
  citesToolResultId: z.string().min(1),
  /** Optional numeric value the claim asserts, enabling exact verification. */
  value: z.number().optional(),
});

export const citedAnswerSchema = z.object({
  text: z.string().min(1),
  claims: z.array(claimSchema),
});
export type CitedAnswer = z.infer<typeof citedAnswerSchema>;

/** The honest "unknown" answer — accepted as success so fabrication has no payoff. */
export const unknownAnswerSchema = z.object({
  unknown: z.literal(true),
  reason: z.string().optional(),
});

export type CitationIssueReason = "unknown-citation" | "value-mismatch";

export interface CitationIssue {
  statement: string;
  reason: CitationIssueReason;
  detail: string;
}

/** Returns the issues found; an empty array means every claim is supported. */
export function verifyCitations(
  answer: CitedAnswer,
  toolResults: ToolCallRecord[],
): CitationIssue[] {
  const successfulData = new Map<string, unknown>();
  for (const r of toolResults) {
    if (r.result.ok) {
      successfulData.set(r.result.id, r.result.data);
    }
  }

  const issues: CitationIssue[] = [];
  for (const claim of answer.claims) {
    if (!successfulData.has(claim.citesToolResultId)) {
      issues.push({
        statement: claim.statement,
        reason: "unknown-citation",
        detail: `no successful tool result with id "${claim.citesToolResultId}"`,
      });
      continue;
    }
    if (
      claim.value !== undefined &&
      !containsNumber(successfulData.get(claim.citesToolResultId), claim.value)
    ) {
      issues.push({
        statement: claim.statement,
        reason: "value-mismatch",
        detail: `tool result "${claim.citesToolResultId}" does not contain the value ${claim.value}`,
      });
    }
  }
  return issues;
}

/** Recursively search a tool-result payload for a number exactly equal to `value`. */
function containsNumber(data: unknown, value: number): boolean {
  if (typeof data === "number") {
    return data === value;
  }
  if (Array.isArray(data)) {
    return data.some((d) => containsNumber(d, value));
  }
  if (data !== null && typeof data === "object") {
    return Object.values(data).some((d) => containsNumber(d, value));
  }
  return false;
}

export type ParsedAnswer =
  | { kind: "cited"; answer: CitedAnswer }
  | { kind: "unknown" }
  | { kind: "invalid" };

/** Classify a model's final string as a cited answer, an honest unknown, or junk. */
export function parseAnswer(content: string): ParsedAnswer {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { kind: "invalid" };
  }
  if (unknownAnswerSchema.safeParse(json).success) {
    return { kind: "unknown" };
  }
  const parsed = citedAnswerSchema.safeParse(json);
  if (parsed.success) {
    return { kind: "cited", answer: parsed.data };
  }
  return { kind: "invalid" };
}
