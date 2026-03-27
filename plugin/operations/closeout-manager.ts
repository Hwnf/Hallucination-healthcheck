import { readFile } from "node:fs/promises";
import type { CloseoutManager } from "../interfaces";
import type { ResolvedContext } from "../types/context";
import type { ArchiveManifest, CloseoutResult, PromotionCandidate } from "../types/lifecycle";
import { writeJsonAtomic } from "../registries/atomic-file";
import { DefaultArchiveManager } from "./archive-manager";
import { DefaultExperienceManager } from "./experience-manager";
import { DefaultPromotionManager } from "./promotion-manager";
import { DefaultAuditLogger } from "./audit-logger";
import { guardRegistryMutation } from "./registry-guard";

const PROJECTS_PATH = "/root/.openclaw/workspace/agents/registry/projects.json";
const MEMORY_SPACES_PATH = "/root/.openclaw/workspace/agents/registry/memory_spaces.json";
const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";

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

export class DefaultCloseoutManager implements CloseoutManager {
  constructor(
    private readonly archiveManager = new DefaultArchiveManager(),
    private readonly promotionManager = new DefaultPromotionManager(),
    private readonly experienceManager = new DefaultExperienceManager(),
    private readonly auditLogger = new DefaultAuditLogger(),
  ) {}

  async closeProject(projectId: string, context: ResolvedContext): Promise<CloseoutResult> {
    const guard = await guardRegistryMutation(["projects", "memorySpaces", "archives", "agents", "promotions"], "project closeout");
    if (!guard.allowed) {
      await this.auditLogger.log({
        timestamp: context.nowIso,
        actorId: context.agentId,
        action: "project_closeout_blocked",
        resourceId: projectId,
        reason: guard.reason ?? "project closeout blocked due to degraded registry health",
        metadata: { degradedRegistries: guard.degradedRegistries },
      });
      return {
        projectId,
        frozen: false,
        archived: false,
        archiveMemoryId: this.archiveManager.makeArchiveMemoryId(projectId),
        promotedCount: 0,
        extractedExperienceCount: 0,
        revokedAccessCount: 0,
        summaryRef: null,
      };
    }

    const archiveMemoryId = this.archiveManager.makeArchiveMemoryId(projectId);
    const closeoutBatch = `closeout_${new Date().toISOString().slice(0, 10).replace(/-/g, "_")}_${projectId}`;

    await this.markProjectClosing(projectId, context.agentId);
    await this.archiveProjectState(projectId, archiveMemoryId);
    const revokedAccessCount = await this.reduceProjectAccess(projectId, archiveMemoryId);

    const manifest: ArchiveManifest = {
      archiveMemoryId,
      projectId,
      archivedAt: context.nowIso,
      archivedBy: context.agentId,
      closeoutBatch,
      projectStatusAtClose: context.lifecycleState ?? "completed",
      summaryRef: `archive://${projectId}/summary`,
      decisionIndexRef: `archive://${projectId}/decisions`,
      artifactIndexRef: `archive://${projectId}/artifacts`,
      experienceExtractions: [],
      promotionOutputs: {
        company: [],
        governance: [],
        user: [],
        experience: [],
      },
      accessPolicy: "cold_storage_default",
      sensitivity: "internal",
    };

    await this.archiveManager.recordArchive(manifest);

    const examplePromotion: PromotionCandidate = {
      sourceMemoryId: projectId,
      sourceScope: "project",
      destinationScope: "company",
      destinationContainer: context.companyId ?? "company_unknown",
      canonicalKey: `${projectId}:closeout:summary`,
      content: `Closeout summary for ${projectId}`,
      summary: `Closeout summary for ${projectId}`,
      confidence: 0.8,
      reason: "Stub promotion created during closeout",
      requestedBy: context.agentId,
      approvedBy: context.agentId,
      status: "approved",
      derivedFrom: [projectId],
      timestamp: context.nowIso,
    };

    await this.promotionManager.propose(examplePromotion);
    manifest.promotionOutputs?.company?.push(examplePromotion.canonicalKey);

    const lessonKey = `${projectId}:closeout:lesson`;
    await this.experienceManager.recordLesson(context.agentId, "agents/experience/orchestrator.md", lessonKey);
    manifest.experienceExtractions?.push(lessonKey);

    await this.markProjectArchived(projectId, manifest.summaryRef ?? null, archiveMemoryId, context.agentId, context.nowIso);

    await this.auditLogger.log({
      timestamp: context.nowIso,
      actorId: context.agentId,
      action: "project_closeout",
      resourceId: projectId,
      reason: `project archived with ${revokedAccessCount} access changes`,
      metadata: {
        archiveMemoryId,
        closeoutBatch,
        promotedCount: 1,
        extractedExperienceCount: 1,
        revokedAccessCount,
      },
    });

    return {
      projectId,
      frozen: true,
      archived: true,
      archiveMemoryId,
      promotedCount: 1,
      extractedExperienceCount: 1,
      revokedAccessCount,
      summaryRef: manifest.summaryRef,
    };
  }

  private async markProjectClosing(projectId: string, actorId: string): Promise<void> {
    const projects = await loadJsonArray(PROJECTS_PATH);
    const project = projects.find((p) => p.project_id === projectId);
    if (project) {
      project.lifecycle_state = "closing";
      project.status = "closing";
      project.last_closeout_attempt = new Date().toISOString();
      project.closeout_owner = actorId;
      await saveJson(PROJECTS_PATH, projects);
    }
  }

  private async archiveProjectState(projectId: string, archiveMemoryId: string): Promise<void> {
    const memorySpaces = await loadJsonArray(MEMORY_SPACES_PATH);
    for (const space of memorySpaces) {
      if (space.memory_id === projectId) {
        space.status = "archived";
        space.retrieval_default = false;
      }
      if (space.memory_id === archiveMemoryId) {
        space.status = "active";
        space.retrieval_default = false;
      }
    }
    await saveJson(MEMORY_SPACES_PATH, memorySpaces);
  }

  private async reduceProjectAccess(projectId: string, archiveMemoryId: string): Promise<number> {
    const agents = await loadJsonArray(AGENTS_PATH);
    let changes = 0;

    for (const agent of agents) {
      if (agent.agent_id === "agent_orchestrator") continue;

      if (Array.isArray(agent.assigned_projects) && agent.assigned_projects.includes(projectId)) {
        agent.assigned_projects = agent.assigned_projects.filter((p: string) => p !== projectId);
        changes += 1;
      }

      if (agent.memory_permissions) {
        for (const key of Object.keys(agent.memory_permissions)) {
          const value = agent.memory_permissions[key];
          if (Array.isArray(value) && value.includes(projectId)) {
            agent.memory_permissions[key] = value.filter((v: string) => v !== projectId && v !== archiveMemoryId);
            changes += 1;
          }
        }
      }

      if (Array.isArray(agent.grants)) {
        const before = agent.grants.length;
        agent.grants = agent.grants.filter((g: any) => g?.resource_id !== projectId && g?.resource_id !== archiveMemoryId);
        changes += before - agent.grants.length;
      }

      if (Array.isArray(agent.denies)) {
        const alreadyDenied = agent.denies.some((d: any) => d?.resource_id === archiveMemoryId);
        if (!alreadyDenied) {
          agent.denies.push({
            grant_id: `deny_${agent.agent_id}_${archiveMemoryId}`,
            resource_id: archiveMemoryId,
            actions: ["read", "write", "restore"],
            effect: "deny",
            reason: "archive access removed after project closeout",
            granted_by: "agent_orchestrator",
            created_at: new Date().toISOString(),
          });
          changes += 1;
        }
      } else {
        agent.denies = [{
          grant_id: `deny_${agent.agent_id}_${archiveMemoryId}`,
          resource_id: archiveMemoryId,
          actions: ["read", "write", "restore"],
          effect: "deny",
          reason: "archive access removed after project closeout",
          granted_by: "agent_orchestrator",
          created_at: new Date().toISOString(),
        }];
        changes += 1;
      }
    }

    await saveJson(AGENTS_PATH, agents);
    return changes;
  }

  private async markProjectArchived(
    projectId: string,
    summaryRef: string | null,
    archiveMemoryId: string,
    actorId: string,
    nowIso: string,
  ): Promise<void> {
    const projects = await loadJsonArray(PROJECTS_PATH);
    const project = projects.find((p) => p.project_id === projectId);
    if (project) {
      project.lifecycle_state = "archived";
      project.status = "archived";
      project.closeout_summary_ref = summaryRef;
      project.archive_memory_id = archiveMemoryId;
      project.archive_manifest_ref = `/root/.openclaw/workspace/agents/archives/${projectId}.manifest.json`;
      project.archived_at = nowIso;
      project.archived_by = actorId;
      project.restore_required = true;
      await saveJson(PROJECTS_PATH, projects);
    }
  }
}
