import { readFile } from "node:fs/promises";
import { writeJsonAtomic } from "../registries/atomic-file";
import { DefaultArchiveManager } from "./archive-manager";
import { DefaultAuditLogger } from "./audit-logger";
import { guardRegistryMutation } from "./registry-guard";

const PROJECTS_PATH = "/root/.openclaw/workspace/agents/registry/projects.json";
const MEMORY_SPACES_PATH = "/root/.openclaw/workspace/agents/registry/memory_spaces.json";
const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const ARCHIVES_PATH = "/root/.openclaw/workspace/agents/registry/archives.json";

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

export interface RestoreRequest {
  projectId: string;
  requestedBy: string;
  agentIds?: string[];
  reason: string;
}

export interface RestoreResult {
  restored: boolean;
  projectId: string;
  archiveMemoryId: string;
  reassignedAgents: string[];
  reason: string;
}

export class DefaultRestoreManager {
  constructor(
    private readonly archiveManager = new DefaultArchiveManager(),
    private readonly auditLogger = new DefaultAuditLogger(),
  ) {}

  async reopen(request: RestoreRequest): Promise<RestoreResult> {
    const guard = await guardRegistryMutation(["projects", "memorySpaces", "agents", "archives"], "project restore");
    if (!guard.allowed) {
      await this.auditLogger.log({
        timestamp: new Date().toISOString(),
        actorId: request.requestedBy,
        action: "project_restore_blocked",
        resourceId: request.projectId,
        reason: guard.reason ?? "project restore blocked due to degraded registry health",
        metadata: { degradedRegistries: guard.degradedRegistries },
      });
      return {
        restored: false,
        projectId: request.projectId,
        archiveMemoryId: this.archiveManager.makeArchiveMemoryId(request.projectId),
        reassignedAgents: [],
        reason: guard.reason ?? "project restore blocked due to degraded registry health",
      };
    }

    if (!request.reason.trim()) {
      return {
        restored: false,
        projectId: request.projectId,
        archiveMemoryId: this.archiveManager.makeArchiveMemoryId(request.projectId),
        reassignedAgents: [],
        reason: "restore denied: reason is required",
      };
    }

    const archiveMemoryId = this.archiveManager.makeArchiveMemoryId(request.projectId);
    await this.restoreProjectState(request.projectId, archiveMemoryId, request.requestedBy, request.reason);
    await this.restoreArchiveRecord(request.projectId, archiveMemoryId, request.requestedBy, request.reason);
    await this.restoreMemorySpaces(request.projectId, archiveMemoryId);
    const reassignedAgents = await this.reassignAgents(request.projectId, archiveMemoryId, request.agentIds ?? []);

    await this.auditLogger.log({
      timestamp: new Date().toISOString(),
      actorId: request.requestedBy,
      action: "project_restore",
      resourceId: request.projectId,
      reason: request.reason,
      metadata: {
        archiveMemoryId,
        reassignedAgents,
      },
    });

    return {
      restored: true,
      projectId: request.projectId,
      archiveMemoryId,
      reassignedAgents,
      reason: "project restored to active state",
    };
  }

  private async restoreProjectState(projectId: string, archiveMemoryId: string, requestedBy: string, reason: string): Promise<void> {
    const projects = await loadJsonArray(PROJECTS_PATH);
    const project = projects.find((p) => p.project_id === projectId);
    if (project) {
      project.lifecycle_state = "active";
      project.status = "active";
      project.archive_memory_id = archiveMemoryId;
      project.restored_at = new Date().toISOString();
      project.restored_by = requestedBy;
      project.last_restore_reason = reason;
      project.restore_required = false;
      project.reopened_from_archive = true;
      project.closeout_owner = null;
      await saveJson(PROJECTS_PATH, projects);
    }
  }

  private async restoreArchiveRecord(projectId: string, archiveMemoryId: string, requestedBy: string, reason: string): Promise<void> {
    const archives = await loadJsonArray(ARCHIVES_PATH);
    let changed = false;

    for (const archive of archives) {
      if (archive.project_id === projectId || archive.archive_memory_id === archiveMemoryId) {
        archive.status = "restored";
        archive.restored_at = new Date().toISOString();
        archive.restored_by = requestedBy;
        archive.restore_reason = reason;
        changed = true;
      }
    }

    if (changed) {
      await saveJson(ARCHIVES_PATH, archives);
    }
  }

  private async restoreMemorySpaces(projectId: string, archiveMemoryId: string): Promise<void> {
    const spaces = await loadJsonArray(MEMORY_SPACES_PATH);
    for (const space of spaces) {
      if (space.memory_id === projectId) {
        space.status = "active";
        space.retrieval_default = true;
      }
      if (space.memory_id === archiveMemoryId) {
        space.status = "active";
        space.retrieval_default = false;
      }
    }
    await saveJson(MEMORY_SPACES_PATH, spaces);
  }

  private async reassignAgents(projectId: string, archiveMemoryId: string, agentIds: string[]): Promise<string[]> {
    if (!agentIds.length) return [];

    const agents = await loadJsonArray(AGENTS_PATH);
    const touched: string[] = [];

    for (const agent of agents) {
      if (!agentIds.includes(agent.agent_id)) continue;

      agent.assigned_projects = Array.isArray(agent.assigned_projects) ? agent.assigned_projects : [];
      if (!agent.assigned_projects.includes(projectId)) {
        agent.assigned_projects.push(projectId);
      }

      agent.memory_permissions = agent.memory_permissions ?? {};
      agent.memory_permissions.read = Array.isArray(agent.memory_permissions.read) ? agent.memory_permissions.read : [];
      if (!agent.memory_permissions.read.includes(projectId)) {
        agent.memory_permissions.read.push(projectId);
      }

      agent.memory_permissions.write = Array.isArray(agent.memory_permissions.write) ? agent.memory_permissions.write : [];
      if (!agent.memory_permissions.write.includes(projectId)) {
        agent.memory_permissions.write.push(projectId);
      }

      agent.denies = Array.isArray(agent.denies) ? agent.denies : [];
      agent.denies = agent.denies.filter((d: any) => d?.resource_id !== archiveMemoryId);

      touched.push(agent.agent_id);
    }

    await saveJson(AGENTS_PATH, agents);
    return touched;
  }
}
