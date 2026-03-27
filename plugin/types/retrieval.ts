import type { ResolvedContext } from "./context";
import type { MemoryRecordV2, MemoryScope } from "./memory";

export type RetrievalIntent =
  | "active_project"
  | "policy_lookup"
  | "user_personalization"
  | "precedent_lookup"
  | "agent_self_recall"
  | "closeout"
  | "archive_lookup";

export interface ScopeRoute {
  intent: RetrievalIntent;
  orderedScopes: MemoryScope[];
  allowColdStorage: boolean;
  maxResultsPerScope?: number;
}

export interface RetrievalRequest {
  context: ResolvedContext;
  intent: RetrievalIntent;
  query: string;
  scopes: MemoryScope[];
  includeArchived?: boolean;
  includeSuperseded?: boolean;
  limit?: number;
}

export interface RetrievalCandidate {
  record: MemoryRecordV2;
  semanticScore?: number;
  scopeScore?: number;
  authorityScore?: number;
  freshnessScore?: number;
  finalScore?: number;
  suppressed?: boolean;
  suppressionReason?: string | null;
}

export interface RetrievalResult {
  context: ResolvedContext;
  intent: RetrievalIntent;
  candidates: RetrievalCandidate[];
  selected: MemoryRecordV2[];
}
