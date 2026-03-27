import type { MemoryScope, MemoryRecordV2, PromotionState, Sensitivity } from "./memory";

export type ContradictionResolutionState =
  | "none"
  | "suspected"
  | "disputed"
  | "resolved"
  | "superseded"
  | "coexisting";

export interface WriteCandidate {
  targetScope: MemoryScope;
  targetContainer: string;
  content: string;
  summary?: string | null;
  confidence?: number | null;
  verificationState?: MemoryRecordV2["verificationState"];
  sourceRefs?: string[];
  tags?: string[];
  metadataOverrides?: Partial<MemoryRecordV2>;
}

export interface WriteDecision {
  allowed: boolean;
  reason: string;
  targetScope?: MemoryScope;
  requiresPromotionReview?: boolean;
  requiresAudit?: boolean;
}

export interface PromotionCandidate {
  sourceMemoryId: string;
  sourceScope: MemoryScope;
  destinationScope: Exclude<MemoryScope, "ephemeral" | "session">;
  destinationContainer: string;
  canonicalKey: string;
  content: string;
  summary?: string | null;
  confidence: number;
  reason: string;
  requestedBy: string;
  approvedBy?: string | null;
  status: PromotionState;
  derivedFrom?: string[];
  timestamp: string;
}

export interface PromotionResult {
  approved: boolean;
  createdMemoryId?: string | null;
  reason: string;
}

export interface ContradictionRecord {
  contradictionSetId: string;
  memoryIds: string[];
  entityKey?: string | null;
  factKey?: string | null;
  resolutionState: ContradictionResolutionState;
  winnerMemoryId?: string | null;
  resolutionReason?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
}

export interface ArchiveManifest {
  archiveMemoryId: string;
  projectId: string;
  archivedAt: string;
  archivedBy: string;
  closeoutBatch: string;
  projectStatusAtClose: string;
  summaryRef?: string | null;
  decisionIndexRef?: string | null;
  artifactIndexRef?: string | null;
  experienceExtractions?: string[];
  promotionOutputs?: {
    company?: string[];
    governance?: string[];
    user?: string[];
    experience?: string[];
  };
  accessPolicy: string;
  sensitivity: Sensitivity;
}

export interface CloseoutResult {
  projectId: string;
  frozen: boolean;
  archived: boolean;
  archiveMemoryId?: string | null;
  promotedCount: number;
  extractedExperienceCount: number;
  revokedAccessCount: number;
  summaryRef?: string | null;
}
