import { readFile } from "node:fs/promises";
import type { ContradictionRecord } from "../types/lifecycle";
import type { MemoryRecordV2 } from "../types/memory";
import { guardRegistryMutation } from "../operations/registry-guard";
import { writeJsonAtomic } from "../registries/atomic-file";

const CONTRADICTIONS_PATH = "/root/.openclaw/workspace/agents/registry/contradictions.json";

async function loadJsonArray(path: string): Promise<any[]> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveJson(path: string, data: unknown): Promise<void> {
  await writeJsonAtomic(path, data);
}

function contradictionSetId(a: MemoryRecordV2, b: MemoryRecordV2): string {
  const left = a.canonicalKey ?? a.memoryId;
  const right = b.canonicalKey ?? b.memoryId;
  const pair = [left, right].sort().join("__");
  return `contradiction_${pair}`;
}

function sameKey(a: MemoryRecordV2, b: MemoryRecordV2): boolean {
  return !!a.canonicalKey && !!b.canonicalKey && a.canonicalKey === b.canonicalKey;
}

function isScopeSplit(a: MemoryRecordV2, b: MemoryRecordV2): boolean {
  return a.memoryScope !== b.memoryScope && (
    (a.memoryScope === "project" && b.memoryScope === "company") ||
    (a.memoryScope === "company" && b.memoryScope === "project") ||
    (a.memoryScope === "project" && b.memoryScope === "governance") ||
    (a.memoryScope === "governance" && b.memoryScope === "project")
  );
}

function toEntry(record: ContradictionRecord, extra: Record<string, unknown> = {}): any {
  return {
    contradiction_set_id: record.contradictionSetId,
    memory_ids: record.memoryIds,
    entity_key: record.entityKey,
    fact_key: record.factKey,
    resolution_state: record.resolutionState,
    winner_memory_id: record.winnerMemoryId ?? null,
    resolution_reason: record.resolutionReason ?? null,
    resolved_by: record.resolvedBy ?? null,
    resolved_at: record.resolvedAt ?? null,
    ...extra,
  };
}

/**
 * Contradiction policy aligned more closely to Blueprint v2.
 *
 * Current behavior:
 * - identifies likely contradictions by canonical key + differing content
 * - distinguishes direct contradictions from scope-split coexistence
 * - can queue contradictions for review instead of auto-resolving
 * - records contradiction/coexistence sets in contradictions.json
 * - resolves winner/loser by simple heuristic when direct resolution is needed
 */
export class DefaultContradictionPolicy {
  isLikelyContradiction(a: MemoryRecordV2, b: MemoryRecordV2): boolean {
    return sameKey(a, b) && a.content.trim() !== b.content.trim();
  }

  async record(a: MemoryRecordV2, b: MemoryRecordV2): Promise<ContradictionRecord> {
    const setId = contradictionSetId(a, b);
    const guard = await guardRegistryMutation(["contradictions"], "contradiction recording");
    if (!guard.allowed) {
      return {
        contradictionSetId: setId,
        memoryIds: [a.memoryId, b.memoryId],
        entityKey: a.canonicalKey ?? b.canonicalKey ?? null,
        factKey: a.canonicalKey ?? b.canonicalKey ?? null,
        resolutionState: "disputed",
        winnerMemoryId: null,
        resolutionReason: guard.reason ?? "contradiction recording blocked due to degraded registry health",
        resolvedBy: "system",
        resolvedAt: new Date().toISOString(),
      };
    }

    let record: ContradictionRecord;
    let entry: any;

    if (this.shouldCoexist(a, b)) {
      record = {
        contradictionSetId: setId,
        memoryIds: [a.memoryId, b.memoryId],
        entityKey: a.canonicalKey ?? b.canonicalKey ?? null,
        factKey: a.canonicalKey ?? b.canonicalKey ?? null,
        resolutionState: "coexisting",
        winnerMemoryId: null,
        resolutionReason: "scope-split coexistence",
        resolvedBy: "system",
        resolvedAt: new Date().toISOString(),
      };
      entry = toEntry(record, { coexistence: true });
    } else {
      const winner = this.pickWinner(a, b);
      const loser = winner.memoryId === a.memoryId ? b : a;
      record = {
        contradictionSetId: setId,
        memoryIds: [a.memoryId, b.memoryId],
        entityKey: a.canonicalKey ?? b.canonicalKey ?? null,
        factKey: a.canonicalKey ?? b.canonicalKey ?? null,
        resolutionState: "resolved",
        winnerMemoryId: winner.memoryId,
        resolutionReason: "verified/active/fresher heuristic",
        resolvedBy: "system",
        resolvedAt: new Date().toISOString(),
      };
      entry = toEntry(record, { loser_memory_id: loser.memoryId });
    }

    await this.upsertEntry(setId, entry);
    return record;
  }

  async queueForReview(a: MemoryRecordV2, b: MemoryRecordV2, requestedBy = "system", reason = "manual contradiction review requested"): Promise<ContradictionRecord> {
    const setId = contradictionSetId(a, b);
    const guard = await guardRegistryMutation(["contradictions"], "contradiction review queue");
    if (!guard.allowed) {
      return {
        contradictionSetId: setId,
        memoryIds: [a.memoryId, b.memoryId],
        entityKey: a.canonicalKey ?? b.canonicalKey ?? null,
        factKey: a.canonicalKey ?? b.canonicalKey ?? null,
        resolutionState: "disputed",
        winnerMemoryId: null,
        resolutionReason: guard.reason ?? "contradiction review queue blocked due to degraded registry health",
        resolvedBy: requestedBy,
        resolvedAt: new Date().toISOString(),
      };
    }

    const record: ContradictionRecord = {
      contradictionSetId: setId,
      memoryIds: [a.memoryId, b.memoryId],
      entityKey: a.canonicalKey ?? b.canonicalKey ?? null,
      factKey: a.canonicalKey ?? b.canonicalKey ?? null,
      resolutionState: "suspected",
      winnerMemoryId: null,
      resolutionReason: reason,
      resolvedBy: requestedBy,
      resolvedAt: new Date().toISOString(),
    };

    await this.upsertEntry(setId, toEntry(record, { review_required: true }));
    return record;
  }

  async resolveQueued(setId: string, winnerMemoryId: string, resolvedBy = "system", reason = "manual contradiction resolution"): Promise<ContradictionRecord | null> {
    const guard = await guardRegistryMutation(["contradictions"], "contradiction resolution");
    if (!guard.allowed) {
      return {
        contradictionSetId: setId,
        memoryIds: [],
        entityKey: null,
        factKey: null,
        resolutionState: "disputed",
        winnerMemoryId: null,
        resolutionReason: guard.reason ?? "contradiction resolution blocked due to degraded registry health",
        resolvedBy,
        resolvedAt: new Date().toISOString(),
      };
    }

    const items = await loadJsonArray(CONTRADICTIONS_PATH);
    const existing = items.find((x: any) => x.contradictionSetId === setId || x.contradiction_set_id === setId);
    if (!existing) return null;

    const record: ContradictionRecord = {
      contradictionSetId: setId,
      memoryIds: existing.memory_ids ?? existing.memoryIds ?? [],
      entityKey: existing.entity_key ?? existing.entityKey ?? null,
      factKey: existing.fact_key ?? existing.factKey ?? null,
      resolutionState: "resolved",
      winnerMemoryId,
      resolutionReason: reason,
      resolvedBy,
      resolvedAt: new Date().toISOString(),
    };

    const loserMemoryId = record.memoryIds.find((id) => id !== winnerMemoryId) ?? null;
    await this.upsertEntry(setId, toEntry(record, {
      loser_memory_id: loserMemoryId,
      review_required: false,
      reviewed: true,
    }));
    return record;
  }

  shouldSuppress(record: MemoryRecordV2, contradictions: any[]): boolean {
    const match = contradictions.find((c: any) => {
      const ids = c.memory_ids ?? c.memoryIds ?? [];
      return Array.isArray(ids) && ids.includes(record.memoryId);
    });
    if (!match) return false;

    const resolutionState = match.resolution_state ?? match.resolutionState;
    if (resolutionState === "coexisting" || resolutionState === "suspected") return false;

    const winner = match.winner_memory_id ?? match.winnerMemoryId;
    return !!winner && winner !== record.memoryId;
  }

  shouldCoexist(a: MemoryRecordV2, b: MemoryRecordV2): boolean {
    return sameKey(a, b) && isScopeSplit(a, b);
  }

  private async upsertEntry(setId: string, entry: any): Promise<void> {
    const items = await loadJsonArray(CONTRADICTIONS_PATH);
    const existingIndex = items.findIndex((x: any) => x.contradictionSetId === setId || x.contradiction_set_id === setId);
    if (existingIndex >= 0) items[existingIndex] = entry;
    else items.push(entry);
    await saveJson(CONTRADICTIONS_PATH, items);
  }

  private pickWinner(a: MemoryRecordV2, b: MemoryRecordV2): MemoryRecordV2 {
    const score = (r: MemoryRecordV2): number => {
      let s = 0;
      if (r.memoryScope === "governance") s += 4;
      if (r.verificationState === "verified") s += 3;
      if (r.status === "active") s += 2;
      if (typeof r.confidence === "number") s += r.confidence;
      if (r.timestamp) s += new Date(r.timestamp).getTime() / 1e15;
      return s;
    };

    return score(a) >= score(b) ? a : b;
  }
}
