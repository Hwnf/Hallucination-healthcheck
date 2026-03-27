export type MemoryScope =
  | "governance"
  | "company"
  | "project"
  | "restricted_shared"
  | "agent_private"
  | "experience"
  | "user"
  | "session"
  | "cold_storage"
  | "ephemeral";

export type Visibility =
  | "shared"
  | "restricted"
  | "private"
  | "orchestrator_only"
  | "operator_only"
  | "manager_operator_only";

export type Sensitivity =
  | "public_safe"
  | "internal"
  | "restricted"
  | "secret";

export type MemoryStatus =
  | "proposed"
  | "approved"
  | "active"
  | "archived"
  | "stale"
  | "rejected"
  | "superseded"
  | "disputed"
  | "resolved";

export type VerificationState =
  | "unverified"
  | "provisional"
  | "verified"
  | "disputed"
  | "resolved";

export type PromotionState =
  | "none"
  | "candidate"
  | "proposed"
  | "approved"
  | "promoted"
  | "rejected";

export type MemoryType =
  | "fact"
  | "decision"
  | "constraint"
  | "playbook"
  | "lesson"
  | "anti_pattern"
  | "preference"
  | "handoff"
  | "status_summary"
  | "policy"
  | "hypothesis"
  | "archive_manifest";

export interface MemoryRecordV2 {
  schemaVersion: "2.0";
  memoryId: string;
  canonicalKey?: string | null;
  memoryType?: MemoryType | null;

  agentId?: string | null;
  agentName?: string | null;
  agentKind?: string | null;

  companyId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  conversationId?: string | null;

  memoryScope: MemoryScope;
  visibility: Visibility;
  sensitivity?: Sensitivity | null;

  writtenBy?: string | null;
  approvedBy?: string | null;

  promotedFrom?: MemoryScope | null;
  promotionState?: PromotionState | null;
  promotionReason?: string | null;

  status: MemoryStatus;
  verificationState?: VerificationState | null;

  confidence?: number | null;
  importance?: string | null;
  retention?: "ephemeral" | "short_term" | "project_lifecycle" | "persistent" | "archival" | null;

  sourceType?: string | null;
  sourceRef?: string | null;
  derivedFrom?: string[] | null;

  contradictionSet?: string | null;
  supersedes?: string[] | null;
  supersededBy?: string | null;

  effectiveFrom?: string | null;
  effectiveUntil?: string | null;

  ttl?: string | null;
  expiresAt?: string | null;
  lastValidatedAt?: string | null;

  retrievalPriority?: number | null;
  qualityScore?: number | null;
  dedupKey?: string | null;

  tags?: string[] | null;
  timestamp: string;

  content: string;
  summary?: string | null;
}
