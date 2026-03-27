import { readFile } from "node:fs/promises";
import type { PromotionBackendWriter, PromotionManager } from "../interfaces";
import { writeJsonAtomic } from "../registries/atomic-file";
import type { PromotionCandidate, PromotionResult } from "../types/lifecycle";
import type { MemoryRecordV2, MemoryScope } from "../types/memory";
import { guardRegistryMutation } from "./registry-guard";

const PROMOTIONS_PATH = "/root/.openclaw/workspace/agents/registry/promotions.json";

async function loadJsonArray(path: string): Promise<any[]> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveJson(path: string, data: unknown): Promise<void> {
  await writeJsonAtomic(path, data);
}

function makePromotionId(): string {
  return `promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeMemoryId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCanonicalKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9:_-]/g, "");
}

function destinationToContainer(destinationScope: MemoryScope, destinationContainer: string): string {
  return destinationContainer;
}

export class DefaultPromotionManager implements PromotionManager {
  constructor(private readonly backendWriter?: PromotionBackendWriter) {}

  async propose(candidate: PromotionCandidate): Promise<PromotionResult> {
    const guard = await guardRegistryMutation(["promotions"], "promotion");
    if (!guard.allowed) {
      return {
        approved: false,
        createdMemoryId: null,
        reason: guard.reason ?? "promotion blocked due to degraded registry health",
      };
    }

    const normalizedKey = normalizeCanonicalKey(candidate.canonicalKey);

    if (!candidate.content.trim()) {
      return {
        approved: false,
        createdMemoryId: null,
        reason: "promotion rejected: empty content",
      };
    }

    if (!normalizedKey) {
      return {
        approved: false,
        createdMemoryId: null,
        reason: "promotion rejected: canonical key missing/invalid",
      };
    }

    if (candidate.confidence < 0.65) {
      return {
        approved: false,
        createdMemoryId: null,
        reason: "promotion rejected: confidence below minimum threshold",
      };
    }

    if ((candidate.status === "approved" || candidate.status === "promoted") && !candidate.approvedBy) {
      return {
        approved: false,
        createdMemoryId: null,
        reason: "promotion rejected: approved/promoted state requires approvedBy",
      };
    }

    let createdMemoryId: string | null = null;
    const shouldCreate = (candidate.status === "approved" || candidate.status === "promoted") && !!this.backendWriter;

    if (shouldCreate) {
      const promotedRecord: MemoryRecordV2 = {
        schemaVersion: "2.0",
        memoryId: makeMemoryId(),
        canonicalKey: normalizedKey,
        memoryType: "playbook",
        memoryScope: candidate.destinationScope,
        visibility: candidate.destinationScope === "governance" ? "orchestrator_only" : "shared",
        sensitivity: "internal",
        writtenBy: candidate.requestedBy,
        approvedBy: candidate.approvedBy ?? null,
        promotedFrom: candidate.sourceScope,
        promotionState: "promoted",
        promotionReason: candidate.reason,
        status: "active",
        verificationState: "verified",
        confidence: candidate.confidence,
        importance: "high",
        retention: candidate.destinationScope === "company" || candidate.destinationScope === "governance" ? "persistent" : "short_term",
        sourceType: "promotion",
        sourceRef: candidate.sourceMemoryId,
        derivedFrom: candidate.derivedFrom ?? [candidate.sourceMemoryId],
        contradictionSet: null,
        supersedes: null,
        supersededBy: null,
        effectiveFrom: candidate.timestamp,
        effectiveUntil: null,
        ttl: null,
        expiresAt: null,
        lastValidatedAt: candidate.timestamp,
        retrievalPriority: null,
        qualityScore: null,
        dedupKey: normalizedKey,
        tags: ["promoted", candidate.destinationScope],
        timestamp: candidate.timestamp,
        content: candidate.content,
        summary: candidate.summary ?? null,
        companyId: candidate.destinationScope === "company" ? destinationToContainer(candidate.destinationScope, candidate.destinationContainer) : null,
        projectId: candidate.sourceScope === "project" ? candidate.sourceMemoryId : null,
        userId: null,
        conversationId: null,
        agentId: candidate.requestedBy,
        agentName: null,
        agentKind: null,
      };

      const result = await this.backendWriter!.write(promotedRecord);
      createdMemoryId = result.memoryId;
    }

    const items = await loadJsonArray(PROMOTIONS_PATH);
    const entry = {
      promotion_id: makePromotionId(),
      from_memory_id: candidate.sourceMemoryId,
      from_scope: candidate.sourceScope,
      to_scope: candidate.destinationScope,
      to_memory_id: candidate.destinationContainer,
      created_memory_id: createdMemoryId,
      canonical_key: normalizedKey,
      requested_by: candidate.requestedBy,
      approved_by: candidate.approvedBy ?? null,
      reason: candidate.reason,
      confidence: candidate.confidence,
      status: candidate.status,
      derived_from: candidate.derivedFrom ?? [],
      timestamp: candidate.timestamp,
    };

    items.push(entry);
    await saveJson(PROMOTIONS_PATH, items);

    return {
      approved: candidate.status === "approved" || candidate.status === "promoted",
      createdMemoryId,
      reason: shouldCreate
        ? `promotion ${candidate.status} recorded and created memory ${createdMemoryId}`
        : `promotion ${candidate.status} recorded with canonical key ${normalizedKey}`,
    };
  }
}
