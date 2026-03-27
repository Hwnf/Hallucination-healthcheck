import { rm } from "node:fs/promises";
import { DefaultAuditLogger } from "../operations/audit-logger";

async function main() {
  const logger = new DefaultAuditLogger();
  try {
    await rm(logger.path(), { force: true });
  } catch {}

  await logger.log({
    timestamp: new Date().toISOString(),
    actorId: "agent_orchestrator",
    action: "break_glass_grant",
    resourceId: "archive_project_supermemory_fork",
    reason: "Need emergency historical context for recovery",
    metadata: { ttlMinutes: 15 },
  });

  await logger.log({
    timestamp: new Date().toISOString(),
    actorId: "agent_orchestrator",
    action: "write_denied",
    resourceId: "agent_someone_else_private",
    reason: "private writes must target the actor's own private container",
    metadata: { scope: "agent_private" },
  });

  await logger.log({
    timestamp: new Date().toISOString(),
    actorId: "agent_manager",
    action: "archive_read",
    resourceId: "archive_project_supermemory_fork",
    reason: "manager archive access",
    metadata: { manifest: "/root/.openclaw/workspace/agents/archives/project_supermemory_fork.manifest.json" },
  });

  const items = await logger.readAll();
  console.log(JSON.stringify({
    path: logger.path(),
    count: items.length,
    actions: items.map((i) => i.action),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
