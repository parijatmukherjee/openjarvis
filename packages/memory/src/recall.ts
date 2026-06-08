import type { Fragment, ScoredFragment } from "./fragment.js";

/** Tunable weights for the blended recall score. Fixed constants in S2. */
export interface RecallWeights {
  text: number;
  importance: number;
  tags: number;
  taintPenalty: number;
  tendrilBonus: number;
  halfLifeMs: number;
}

export const DEFAULT_WEIGHTS: RecallWeights = {
  text: 1,
  importance: 1,
  tags: 0.5,
  taintPenalty: 0.5,
  tendrilBonus: 0.25,
  halfLifeMs: 7 * 86_400_000, // 7 days
};

/** A fragment paired with its raw FTS5 bm25 score (lower/more-negative = better). */
export interface Candidate {
  fragment: Fragment;
  bm25: number;
}

/** What the query contributes to scoring, beyond the text match. */
export interface RecallContext {
  now: number;
  tags?: string[];
  tendril?: string;
}

/** Exponential decay in [0,1]: 1 at age 0, halving every half-life. */
export function decay(ageMs: number, halfLifeMs: number): number {
  return 0.5 ** (ageMs / halfLifeMs);
}

/**
 * Build an FTS5 MATCH expression from free text: lowercase, extract word tokens,
 * dedupe, and OR them so any term can match. Returns null if no usable token —
 * the caller then skips the FTS query (no candidates).
 */
export function toMatchQuery(text: string): string | null {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const m of text.toLowerCase().matchAll(/[a-z0-9]+/g)) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      tokens.push(m[0]);
    }
  }
  return tokens.length > 0 ? tokens.join(" OR ") : null;
}

/** Blended relevance score (higher = more relevant). Pure function. */
export function scoreCandidate(
  c: Candidate,
  ctx: RecallContext,
  w: RecallWeights = DEFAULT_WEIGHTS,
): number {
  const text = w.text * -c.bm25; // bm25 is negative for matches; negate so better -> larger
  const age = Math.max(0, ctx.now - c.fragment.lastUsedAt);
  const importance = w.importance * c.fragment.importance * decay(age, w.halfLifeMs);
  const tags = w.tags * tagOverlap(ctx.tags ?? [], c.fragment.tags);
  const taint = c.fragment.taint ? w.taintPenalty : 0;
  const tendril =
    ctx.tendril !== undefined && ctx.tendril === c.fragment.tendril ? w.tendrilBonus : 0;
  return text + importance + tags - taint + tendril;
}

/** Score every candidate, sort by score descending, attach the score, take top k. */
export function rankCandidates(
  candidates: Candidate[],
  ctx: RecallContext,
  k: number,
  w: RecallWeights = DEFAULT_WEIGHTS,
): ScoredFragment[] {
  return candidates
    .map((c) => ({ ...c.fragment, score: scoreCandidate(c, ctx, w) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Fraction of the query's tags present on the fragment, in [0,1]. */
function tagOverlap(queryTags: string[], fragmentTags: string[]): number {
  if (queryTags.length === 0) {
    return 0;
  }
  const have = new Set(fragmentTags);
  const hits = queryTags.reduce((n, t) => (have.has(t) ? n + 1 : n), 0);
  return hits / queryTags.length;
}
