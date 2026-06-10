import type { Trust } from "@openjarvis/core";

/**
 * A unit of decay-aware memory (JarvisMemoryStore). `importance` is mutated by `reinforce`;
 * `taint` (untrusted origin, via the Gate) down-ranks the fragment at recall. The
 * `tendril` tag names the owning specialist agent — set now, used for per-agent recall
 * bias in S3.
 */
export interface Fragment {
  id: string;
  text: string;
  tendril?: string;
  tags: string[];
  importance: number; // 0..1
  trust: Trust;
  taint: boolean;
  createdAt: number;
  lastUsedAt: number;
  uses: number;
}

/** A fragment with the recall score that ranked it (higher = more relevant). */
export interface ScoredFragment extends Fragment {
  score: number;
}
