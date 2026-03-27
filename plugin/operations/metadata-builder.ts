import type { MetadataBuilder } from "../interfaces";
import type { ResolvedContext } from "../types/context";
import type { WriteCandidate } from "../types/lifecycle";
import type { MemoryRecordV2, MemoryScope, Visibility, Sensitivity } from "../types/memory";

function makeMemoryId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultVisibility(scope: MemoryScope): Visibility {
  switch (scope) {
    case "governance":
      return "orchestrator_only";
    case "restricted_shared":
      return "restricted";
    case "agent_private":
    case "user":
      return "private";
    case "cold_storage":
      return "manager_operator_only";
    default:
      return "shared";
  }
}

function defaultSensitivity(scope: MemoryScope): Sensitivity {
  switch (scope) {
    case "governance":
    case "restricted_shared":
    case "cold_storage":
      return "restricted";
    case "agent_private":
    case "user":
      return "secret";
    default:
      return "internal";
  }
}

function defaultRetention(scope: MemoryScope): MemoryRecordV2["retention"] {
  switch (scope) {
    case "ephemeral":
      return "ephemeral";
    case "session":
    case "user":
      return "short_term";
    case "project":
      return "project_lifecycle";
    case "cold_storage":
    case "governance":
    case "company":
    case "experience":
      return "persistent";
    default:
      return "short_term";
  }
}

function defaultSourceType(scope: MemoryScope, context: ResolvedContext, candidate: WriteCandidate): string {
  if (candidate.metadataOverrides?.sourceType) return String(candidate.metadataOverrides.sourceType);
  if (scope === "cold_storage") return "closeout_flow";
  if (String(context.lifecycleState ?? "").toLowerCase() === "archived") return "restore_flow";
  return "agent";
}

function defaultStatus(scope: MemoryScope): MemoryRecordV2["status"] {
  return scope === "cold_storage" ? "archived" : "active";
}

function defaultDedupKey(scope: MemoryScope, candidate: WriteCandidate, context: ResolvedContext): string | null {
  const base = candidate.summary?.trim() || candidate.content.trim().slice(0, 80);
  if (!base) return null;
  return `${scope}:${context.projectId ?? context.companyId ?? context.agentId}:${base.toLowerCase()}`;
}

/**
 * Central v2 metadata construction stub.
 */
export class DefaultMetadataBuilder implements MetadataBuilder {
  async build(candidate: WriteCandidate, context: ResolvedContext): Promise<MemoryRecordV2> {
    const base: MemoryRecordV2 = {
      schemaVersion: "2.0",
      memoryId: makeMemoryId(),
      canonicalKey: null,
      memoryType: null,
      agentId: context.agentId,
      agentName: context.agentName,
      agentKind: context.agentKind,
      companyId: context.companyId ?? null,
      projectId: context.projectId ?? null,
      userId: context.userId ?? null,
      conversationId: context.conversationId ?? null,
      memoryScope: candidate.targetScope,
      visibility: defaultVisibility(candidate.targetScope),
      sensitivity: defaultSensitivity(candidate.targetScope),
      writtenBy: context.agentId,
      approvedBy: null,
      promotedFrom: null,
      promotionState: "none",
      promotionReason: null,
      status: defaultStatus(candidate.targetScope),
      verificationState: candidate.verificationState ?? null,
      confidence: candidate.confidence ?? null,
      importance: candidate.targetScope === "governance" ? "high" : null,
      retention: defaultRetention(candidate.targetScope),
      sourceType: defaultSourceType(candidate.targetScope, context, candidate),
      sourceRef: null,
      derivedFrom: candidate.sourceRefs ?? null,
      contradictionSet: null,
      supersedes: null,
      supersededBy: null,
      effectiveFrom: context.nowIso,
      effectiveUntil: null,
      ttl: candidate.targetScope === "ephemeral" ? "PT1H" : null,
      expiresAt: null,
      lastValidatedAt: context.nowIso,
      retrievalPriority: candidate.targetScope === "governance" ? 90 : candidate.targetScope === "company" ? 70 : candidate.targetScope === "project" ? 60 : candidate.targetScope === "cold_storage" ? 20 : null,
      qualityScore: candidate.confidence ?? null,
      dedupKey: defaultDedupKey(candidate.targetScope, candidate, context),
      tags: candidate.tags ?? null,
      timestamp: context.nowIso,
      content: candidate.content,
      summary: candidate.summary ?? null,
    };

    return {
      ...base,
      ...(candidate.metadataOverrides ?? {}),
    };
  }
}
