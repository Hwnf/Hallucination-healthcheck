import { writeFile, readFile, copyFile, rm } from "node:fs/promises";
import { DefaultPromotionManager } from "../operations/promotion-manager";
import { DefaultContradictionPolicy } from "../policy/contradiction-policy";
import { DefaultCloseoutManager } from "../operations/closeout-manager";
import { DefaultRestoreManager } from "../operations/restore-manager";
import { DefaultAuditLogger } from "../operations/audit-logger";
import type { MemoryRecordV2 } from "../types/memory";

const PROMOTIONS_PATH = "/root/.openclaw/workspace/agents/registry/promotions.json";
const PROMOTIONS_BACKUP = "/root/.openclaw/workspace/plugin/tests/fixtures/promotions.manager-guard.backup.json";
const PROJECTS_PATH = "/root/.openclaw/workspace/agents/registry/projects.json";
const PROJECTS_BACKUP = "/root/.openclaw/workspace/plugin/tests/fixtures/projects.manager-guard.backup.json";

async function main() {
  await copyFile(PROMOTIONS_PATH, PROMOTIONS_BACKUP);
  await copyFile(PROJECTS_PATH, PROJECTS_BACKUP);

  const logger = new DefaultAuditLogger();
  try {
    await rm(logger.path(), { force: true });
  } catch {}

  try {
    await writeFile(PROMOTIONS_PATH, JSON.stringify({ broken: true }, null, 2) + "\n", "utf8");
    await writeFile(PROJECTS_PATH, JSON.stringify({ broken: true }, null, 2) + "\n", "utf8");

    const promotion = await new DefaultPromotionManager().propose({
      sourceMemoryId: "project_supermemory_fork",
      sourceScope: "project",
      destinationScope: "company",
      destinationContainer: "company_web",
      canonicalKey: "Deployment Timeout Runbook",
      content: "Reusable deployment timeout mitigation runbook.",
      summary: "Deployment timeout runbook.",
      confidence: 0.84,
      reason: "Observed repeatedly and useful across web projects",
      requestedBy: "agent_orchestrator",
      approvedBy: "agent_orchestrator",
      status: "approved",
      derivedFrom: ["project_supermemory_fork"],
      timestamp: new Date().toISOString(),
    });

    const oldMem: MemoryRecordV2 = {
      schemaVersion: "2.0",
      memoryId: "mem_old",
      canonicalKey: "react:deployment:pattern-x",
      memoryScope: "company",
      visibility: "shared",
      status: "active",
      verificationState: "provisional",
      confidence: 0.6,
      timestamp: "2026-03-20T00:00:00Z",
      content: "Use old pattern X",
      summary: "Old pattern",
    };
    const newMem: MemoryRecordV2 = {
      schemaVersion: "2.0",
      memoryId: "mem_new",
      canonicalKey: "react:deployment:pattern-x",
      memoryScope: "company",
      visibility: "shared",
      status: "active",
      verificationState: "verified",
      confidence: 0.9,
      timestamp: "2026-03-25T00:00:00Z",
      content: "Use new pattern X2",
      summary: "New pattern",
    };
    const contradiction = await new DefaultContradictionPolicy().record(oldMem, newMem);

    const closeout = await new DefaultCloseoutManager().closeProject("project_supermemory_fork", {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      companyId: "company_web",
      projectId: "project_supermemory_fork",
      provider: "discord",
      channel: "discord",
      lifecycleState: "active",
      nowIso: new Date().toISOString(),
      roles: [],
      capabilities: [],
    });

    const restore = await new DefaultRestoreManager().reopen({
      projectId: "project_supermemory_fork",
      requestedBy: "agent_orchestrator",
      agentIds: ["agent_builder"],
      reason: "Resume work",
    });

    const audits = await logger.readAll();
    console.log(JSON.stringify({
      promotion,
      contradiction,
      closeout,
      restore,
      blockedActions: audits.filter((a) => a.action.endsWith("_blocked")).map((a) => a.action),
    }, null, 2));
  } finally {
    const promotionsOriginal = await readFile(PROMOTIONS_BACKUP, "utf8");
    const projectsOriginal = await readFile(PROJECTS_BACKUP, "utf8");
    await writeFile(PROMOTIONS_PATH, promotionsOriginal, "utf8");
    await writeFile(PROJECTS_PATH, projectsOriginal, "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
