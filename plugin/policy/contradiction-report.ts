import { readFile } from "node:fs/promises";
import type { ContradictionResolutionState } from "../types/lifecycle";

const CONTRADICTIONS_PATH = "/root/.openclaw/workspace/agents/registry/contradictions.json";

export interface ContradictionReportEntry {
  contradictionSetId: string;
  memoryIds: string[];
  entityKey: string | null;
  factKey: string | null;
  resolutionState: ContradictionResolutionState;
  winnerMemoryId: string | null;
  loserMemoryId: string | null;
  resolutionReason: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  reviewRequired: boolean;
  reviewed: boolean;
}

export interface ContradictionReportSummary {
  total: number;
  byState: Record<string, number>;
  openReviewCount: number;
  resolvedCount: number;
}

async function loadJsonArray(path: string): Promise<any[]> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalize(entry: any): ContradictionReportEntry {
  return {
    contradictionSetId: entry.contradiction_set_id ?? entry.contradictionSetId,
    memoryIds: entry.memory_ids ?? entry.memoryIds ?? [],
    entityKey: entry.entity_key ?? entry.entityKey ?? null,
    factKey: entry.fact_key ?? entry.factKey ?? null,
    resolutionState: (entry.resolution_state ?? entry.resolutionState ?? "none") as ContradictionResolutionState,
    winnerMemoryId: entry.winner_memory_id ?? entry.winnerMemoryId ?? null,
    loserMemoryId: entry.loser_memory_id ?? entry.loserMemoryId ?? null,
    resolutionReason: entry.resolution_reason ?? entry.resolutionReason ?? null,
    resolvedBy: entry.resolved_by ?? entry.resolvedBy ?? null,
    resolvedAt: entry.resolved_at ?? entry.resolvedAt ?? null,
    reviewRequired: Boolean(entry.review_required ?? entry.reviewRequired),
    reviewed: Boolean(entry.reviewed),
  };
}

export class ContradictionReportReader {
  async listAll(): Promise<ContradictionReportEntry[]> {
    const items = await loadJsonArray(CONTRADICTIONS_PATH);
    return items.map(normalize);
  }

  async listOpenReview(limit = 20): Promise<ContradictionReportEntry[]> {
    return (await this.listAll())
      .filter((entry) => entry.reviewRequired || entry.resolutionState === "suspected")
      .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""))
      .slice(0, limit);
  }

  async listResolved(limit = 20): Promise<ContradictionReportEntry[]> {
    return (await this.listAll())
      .filter((entry) => entry.resolutionState === "resolved")
      .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""))
      .slice(0, limit);
  }

  async summary(): Promise<ContradictionReportSummary> {
    const items = await this.listAll();
    const byState: Record<string, number> = {};
    for (const entry of items) {
      byState[entry.resolutionState] = (byState[entry.resolutionState] ?? 0) + 1;
    }
    return {
      total: items.length,
      byState,
      openReviewCount: items.filter((entry) => entry.reviewRequired || entry.resolutionState === "suspected").length,
      resolvedCount: items.filter((entry) => entry.resolutionState === "resolved").length,
    };
  }
}
