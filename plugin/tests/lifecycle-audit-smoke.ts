import { readFile, copyFile } from "node:fs/promises";
import { DefaultCloseoutManager } from "../operations/closeout-manager";
import { DefaultRestoreManager } from "../operations/restore-manager";
import { DefaultAuditLogger } from "../operations/audit-logger";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const FIXTURE_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/multi-agent-agents.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/agents.lifecycle-audit.backup.json";
const ARCHIVES_PATH = "/root/.openclaw/workspace/agents/registry/archives.json";

async function main() {
  await copyFile(AGENTS_PATH, BACKUP_PATH);
  await copyFile(FIXTURE_PATH, AGENTS_PATH);

  const logger = new DefaultAuditLogger();

  try {
    const closeout = new DefaultCloseoutManager();
    const closeoutResult = await closeout.closeProject("project_supermemory_fork", {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      userId: "436403292009005066",
      conversationId: "conv_lifecycle_audit",
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
    const restoreResult = await restore.reopen({
      projectId: "project_supermemory_fork",
      requestedBy: "agent_orchestrator",
      agentIds: ["agent_builder"],
      reason: "Resume archived project for follow-up work",
    });

    const audits = await logger.readAll();
    const lifecycleAudits = audits.filter((item) => ["project_closeout", "project_restore"].includes(item.action));

    const archivesRaw = await readFile(ARCHIVES_PATH, "utf8");
    const archives = JSON.parse(archivesRaw);
    const projectEntries = archives.filter((item: any) => item.project_id === "project_supermemory_fork");

    console.log(JSON.stringify({
      closeoutResult,
      restoreResult,
      lifecycleAuditActions: lifecycleAudits.map((item) => item.action),
      projectArchiveEntries: projectEntries,
      canonicalArchiveIds: projectEntries.map((item: any) => item.archive_memory_id),
    }, null, 2));
  } finally {
    await copyFile(BACKUP_PATH, AGENTS_PATH);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
