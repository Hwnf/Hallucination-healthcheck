import { readFile, writeFile, copyFile } from "node:fs/promises";
import { DefaultCloseoutManager } from "../operations/closeout-manager";
import { DefaultRestoreManager } from "../operations/restore-manager";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const PROJECTS_PATH = "/root/.openclaw/workspace/agents/registry/projects.json";
const ARCHIVES_PATH = "/root/.openclaw/workspace/agents/registry/archives.json";
const FIXTURE_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/multi-agent-agents.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/agents.restore.backup.json";

async function main() {
  await copyFile(AGENTS_PATH, BACKUP_PATH);
  await copyFile(FIXTURE_PATH, AGENTS_PATH);

  try {
    const closeout = new DefaultCloseoutManager();
    await closeout.closeProject("project_supermemory_fork", {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      userId: "436403292009005066",
      conversationId: "conv_restore_setup",
      companyId: "company_web",
      projectId: "project_supermemory_fork",
      provider: "discord",
      channel: "discord",
      lifecycleState: "completed",
      roles: [],
      capabilities: [],
      nowIso: new Date().toISOString(),
    });

    const restore = new DefaultRestoreManager();
    const result = await restore.reopen({
      projectId: "project_supermemory_fork",
      requestedBy: "agent_orchestrator",
      agentIds: ["agent_builder", "agent_reviewer"],
      reason: "Resume archived project for follow-up work",
    });

    const raw = await readFile(AGENTS_PATH, "utf8");
    const agents = JSON.parse(raw);
    const builder = agents.find((a: any) => a.agent_id === "agent_builder");
    const reviewer = agents.find((a: any) => a.agent_id === "agent_reviewer");

    const projectsRaw = await readFile(PROJECTS_PATH, "utf8");
    const projects = JSON.parse(projectsRaw);
    const project = projects.find((p: any) => p.project_id === "project_supermemory_fork");

    const archivesRaw = await readFile(ARCHIVES_PATH, "utf8");
    const archives = JSON.parse(archivesRaw);
    const archive = archives.find((a: any) => a.project_id === "project_supermemory_fork");

    console.log(JSON.stringify({
      result,
      builderAssignedProjects: builder?.assigned_projects,
      reviewerAssignedProjects: reviewer?.assigned_projects,
      builderReadPermissions: builder?.memory_permissions?.read,
      builderWritePermissions: builder?.memory_permissions?.write,
      reviewerReadPermissions: reviewer?.memory_permissions?.read,
      reviewerWritePermissions: reviewer?.memory_permissions?.write,
      builderDenies: builder?.denies,
      reviewerDenies: reviewer?.denies,
      projectLifecycle: project?.lifecycle_state,
      projectRestoreRequired: project?.restore_required,
      projectReopenedFromArchive: project?.reopened_from_archive,
      archiveStatus: archive?.status,
      archiveRestoredBy: archive?.restored_by,
      archiveRestoreReason: archive?.restore_reason,
    }, null, 2));
  } finally {
    await copyFile(BACKUP_PATH, AGENTS_PATH);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
