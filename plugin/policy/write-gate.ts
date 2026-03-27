import { readFile } from "node:fs/promises";
import type { ResolvedContext } from "../types/context";
import type { WriteCandidate, WriteDecision } from "../types/lifecycle";

const PROJECTS_PATH = "/root/.openclaw/workspace/agents/registry/projects.json";
const MEMORY_SPACES_PATH = "/root/.openclaw/workspace/agents/registry/memory_spaces.json";

async function loadJsonArray(path: string): Promise<any[]> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isLikelyTranscriptJunk(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("<<<") || lower.includes(">>>") || lower.includes("raw transcript") || lower.includes("tool output dump");
}

function archiveProjectIdFromMemoryId(memoryId: string): string | null {
  if (!memoryId.startsWith("archive_project_")) return null;
  return `project_${memoryId.slice("archive_project_".length)}`;
}

async function loadLifecycleState(targetContainer: string): Promise<{
  project: any | null;
  memorySpace: any | null;
  projectState: string | null;
}> {
  const [projects, memorySpaces] = await Promise.all([
    loadJsonArray(PROJECTS_PATH),
    loadJsonArray(MEMORY_SPACES_PATH),
  ]);

  const memorySpace = memorySpaces.find((m: any) => m.memory_id === targetContainer) ?? null;
  const inferredProjectId = archiveProjectIdFromMemoryId(targetContainer);
  const project = projects.find((p: any) =>
    p.project_id === targetContainer ||
    p.memory_id === targetContainer ||
    p.project_id === inferredProjectId ||
    p.archive_memory_id === targetContainer,
  ) ?? null;

  return {
    project,
    memorySpace,
    projectState: project?.lifecycle_state ?? project?.status ?? memorySpace?.status ?? null,
  };
}

/**
 * Write gate aligned more closely to Blueprint v2.
 *
 * Current rules:
 * - reject empty content
 * - reject likely transcript/tool-dump junk
 * - reject governance writes unless orchestrator
 * - reject writes into closing/archived project spaces unless explicitly archive/restore scoped
 * - reject cold-storage writes outside project closeout/archive flows
 * - reject restricted/private/user writes unless actor/context is plausibly aligned
 */
export class DefaultWriteGate {
  async decide(context: ResolvedContext, candidate: WriteCandidate): Promise<WriteDecision> {
    const trimmed = candidate.content.trim();

    if (!trimmed) {
      return {
        allowed: false,
        reason: "empty content cannot be written",
        requiresAudit: false,
      };
    }

    if (isLikelyTranscriptJunk(trimmed)) {
      return {
        allowed: false,
        reason: "raw transcript/tool-dump style content blocked by write gate",
        requiresAudit: false,
      };
    }

    if (candidate.targetScope === "governance" && context.agentId !== "agent_orchestrator") {
      return {
        allowed: false,
        reason: "governance writes require orchestrator authority",
        requiresAudit: true,
      };
    }

    const lifecycle = await loadLifecycleState(candidate.targetContainer);
    const looksLikeArchiveFlow = (candidate.metadataOverrides?.memoryType === "archive_manifest") ||
      candidate.targetContainer.startsWith("archive_project_");
    const looksLikeRestoreFlow = candidate.metadataOverrides?.sourceType === "restore_flow" ||
      candidate.metadataOverrides?.tags?.includes("restore") ||
      false;

    if (candidate.targetScope === "project" && lifecycle.projectState === "closing" && !looksLikeArchiveFlow && context.agentId !== "agent_orchestrator") {
      return {
        allowed: false,
        reason: "project writes blocked while project is closing",
        requiresAudit: true,
      };
    }

    if (candidate.targetScope === "project" && lifecycle.projectState === "archived" && !looksLikeRestoreFlow) {
      return {
        allowed: false,
        reason: "project writes blocked while project is archived; restore/reopen required",
        requiresAudit: true,
      };
    }

    if (candidate.targetScope === "cold_storage") {
      if (!looksLikeArchiveFlow) {
        return {
          allowed: false,
          reason: "cold-storage writes must come from archive/closeout flow",
          requiresAudit: true,
        };
      }
    }

    if (candidate.targetScope === "user" && !context.userId) {
      return {
        allowed: false,
        reason: "user-scope writes require a resolved userId",
        requiresAudit: true,
      };
    }

    if (candidate.targetScope === "agent_private") {
      const expected = `agent_${context.agentId}_private`;
      if (candidate.targetContainer !== expected) {
        return {
          allowed: false,
          reason: "private writes must target the actor's own private container",
          requiresAudit: true,
        };
      }
    }

    return {
      allowed: true,
      reason: `write allowed for ${candidate.targetScope} by ${context.agentId}`,
      targetScope: candidate.targetScope,
      requiresPromotionReview: ["company", "governance", "restricted_shared"].includes(candidate.targetScope),
      requiresAudit: ["governance", "restricted_shared", "cold_storage", "user", "agent_private", "project"].includes(candidate.targetScope),
    };
  }
}
