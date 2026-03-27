import { readFile } from "node:fs/promises";
import type { RetrievalGate } from "../interfaces";
import type { RetrievalCandidate, RetrievalRequest, RetrievalResult } from "../types/retrieval";
import { DefaultContradictionPolicy } from "./contradiction-policy";

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

/**
 * Retrieval gate with contradiction suppression.
 */
export class DefaultRetrievalGate implements RetrievalGate {
  constructor(private readonly contradictionPolicy = new DefaultContradictionPolicy()) {}

  async filter(request: RetrievalRequest, candidates: RetrievalCandidate[]): Promise<RetrievalResult> {
    const contradictions = await loadJsonArray(CONTRADICTIONS_PATH);

    const selected = candidates
      .filter((c) => request.includeArchived || c.record.status !== "archived")
      .filter((c) => request.includeSuperseded || c.record.status !== "superseded")
      .filter((c) => !this.contradictionPolicy.shouldSuppress(c.record, contradictions))
      .filter((c) => !c.suppressed)
      .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
      .slice(0, request.limit ?? 10)
      .map((c) => c.record);

    return {
      context: request.context,
      intent: request.intent,
      candidates,
      selected,
    };
  }
}
