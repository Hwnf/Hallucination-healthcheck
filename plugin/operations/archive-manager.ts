import { readFile } from "node:fs/promises";
import type { ArchiveManifest } from "../types/lifecycle";
import type { ResolvedContext } from "../types/context";
import { writeJsonAtomic } from "../registries/atomic-file";
import { guardRegistryMutation } from "./registry-guard";

const ARCHIVES_PATH = "/root/.openclaw/workspace/agents/registry/archives.json";
const MEMORY_SPACES_PATH = "/root/.openclaw/workspace/agents/registry/memory_spaces.json";
const ARCHIVE_MANIFESTS_DIR = "/root/.openclaw/workspace/agents/archives";

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

export interface ArchiveReadDecision {
  allowed: boolean;
  reason: string;
  manifestPath?: string | null;
}

/**
 * Archive manager with richer Blueprint v2-aligned behavior.
 */
export class DefaultArchiveManager {
  makeArchiveMemoryId(projectId: string): string {
    const normalized = projectId.startsWith("project_") ? projectId.slice("project_".length) : projectId;
    return `archive_project_${normalized}`;
  }

  manifestPath(projectId: string): string {
    return `${ARCHIVE_MANIFESTS_DIR}/${projectId}.manifest.json`;
  }

  async recordArchive(manifest: ArchiveManifest): Promise<void> {
    const guard = await guardRegistryMutation(["archives", "memorySpaces"], "archive recording");
    if (!guard.allowed) {
      throw new Error(guard.reason ?? "archive recording blocked due to degraded registry health");
    }

    const items = await loadJsonArray(ARCHIVES_PATH);
    const entry = {
      archive_id: manifest.closeoutBatch,
      project_id: manifest.projectId,
      archive_memory_id: manifest.archiveMemoryId,
      status: "archived",
      archived_by: manifest.archivedBy,
      archived_at: manifest.archivedAt,
      summary_ref: manifest.summaryRef ?? null,
      decision_index_ref: manifest.decisionIndexRef ?? null,
      artifact_index_ref: manifest.artifactIndexRef ?? null,
      access_policy: manifest.accessPolicy,
      sensitivity: manifest.sensitivity,
      promotion_outputs: manifest.promotionOutputs ?? {},
      experience_extractions: manifest.experienceExtractions ?? [],
    };

    const canonicalArchiveMemoryId = this.makeArchiveMemoryId(manifest.projectId);
    const filtered = items.filter((x: any) => !(x?.project_id === manifest.projectId));
    filtered.push({
      ...entry,
      archive_memory_id: canonicalArchiveMemoryId,
    });

    await saveJson(ARCHIVES_PATH, filtered);
    await this.writeManifest({
      ...manifest,
      archiveMemoryId: canonicalArchiveMemoryId,
    });
    await this.ensureArchiveMemorySpace(canonicalArchiveMemoryId, manifest.sensitivity);
  }

  async writeManifest(manifest: ArchiveManifest): Promise<void> {
    await writeJsonAtomic(this.manifestPath(manifest.projectId), manifest);
  }

  async canReadArchive(context: ResolvedContext, projectId: string): Promise<ArchiveReadDecision> {
    const manifestPath = this.manifestPath(projectId);
    const archiveMemoryId = this.makeArchiveMemoryId(projectId);
    const archives = await loadJsonArray(ARCHIVES_PATH);
    const memorySpaces = await loadJsonArray(MEMORY_SPACES_PATH);
    const archiveEntry = archives.find((a: any) => a.project_id === projectId || a.archive_memory_id === archiveMemoryId);
    const archiveSpace = memorySpaces.find((m: any) => m.memory_id === archiveMemoryId);

    if (!archiveEntry || !archiveSpace) {
      return {
        allowed: false,
        reason: "archive record not found",
        manifestPath: null,
      };
    }

    const elevatedRoles = new Set(["operators", "managers", "operator", "manager"]);
    const hasElevatedRole = (context.roles ?? []).some((r) => elevatedRoles.has(String(r)));
    const isOrchestrator = context.agentId === "agent_orchestrator" || context.agentKind === "orchestrator";

    if (!isOrchestrator && !hasElevatedRole) {
      return {
        allowed: false,
        reason: "archive access requires orchestrator or manager/operator role",
        manifestPath,
      };
    }

    return {
      allowed: true,
      reason: "archive access allowed by role",
      manifestPath,
    };
  }

  private async ensureArchiveMemorySpace(archiveMemoryId: string, sensitivity: string): Promise<void> {
    const spaces = await loadJsonArray(MEMORY_SPACES_PATH);
    const existing = spaces.find((x: any) => x.memory_id === archiveMemoryId);
    if (existing) {
      existing.scope = "cold_storage";
      existing.status = "active";
      existing.retrieval_default = false;
      existing.sensitivity = sensitivity;
      existing.default_read_policy = "explicit_archive_authorization";
    } else {
      spaces.push({
        memory_id: archiveMemoryId,
        scope: "cold_storage",
        status: "active",
        owner: "agent_orchestrator",
        readers: ["agent_orchestrator", "operators", "managers"],
        writers: ["agent_orchestrator"],
        retention: "archival",
        default_read_policy: "explicit_archive_authorization",
        default_write_policy: "closeout_process_only",
        review_policy: "manifest_correction_only",
        promotion_policy: "none",
        archive_policy: "immutable_archive",
        retrieval_default: false,
        retrieval_rank: 0,
        immutable: true,
        supersession_mode: "link_not_delete",
        sensitivity,
        schema_version: "2.0",
      });
    }
    await saveJson(MEMORY_SPACES_PATH, spaces);
  }
}
