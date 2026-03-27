import { readFile, writeFile, copyFile } from "node:fs/promises";
import { DefaultBreakGlassManager } from "../operations/break-glass-manager";
import { DefaultAclEngine } from "../policy/acl-engine";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/agents.breakglass.backup.json";

async function main() {
  await copyFile(AGENTS_PATH, BACKUP_PATH);

  try {
    const raw = await readFile(AGENTS_PATH, "utf8");
    const agents = JSON.parse(raw);

    agents.push({
      agent_id: "agent_emergency",
      display_name: "Emergency Agent",
      status: "active",
      capabilities: [],
      assigned_projects: [],
      private_memory_id: "agent_emergency_private",
      experience_file: "agents/experience/emergency.md",
      lifecycle_state: "active",
      specialization: "support",
      memory_permissions: { read: [] },
      grants: [],
      denies: [],
      escalation_rights: false,
      schema_version: "2.0"
    });

    await writeFile(AGENTS_PATH, JSON.stringify(agents, null, 2) + "\n", "utf8");

    const manager = new DefaultBreakGlassManager();
    const result = await manager.grant({
      agentId: "agent_emergency",
      resourceId: "archive_project_supermemory_fork",
      actions: ["read"],
      reason: "Need emergency historical context for recovery",
      grantedBy: "agent_orchestrator",
      ttlMinutes: 15,
    });

    const acl = new DefaultAclEngine();
    const access = await acl.can(
      {
        agentId: "agent_emergency",
        agentName: "Emergency Agent",
        agentKind: "agent",
        provider: "discord",
        channel: "discord",
        nowIso: new Date().toISOString(),
        roles: [],
        capabilities: [],
      },
      "read",
      "archive_project_supermemory_fork",
    );

    console.log(JSON.stringify({ result, access }, null, 2));
  } finally {
    await copyFile(BACKUP_PATH, AGENTS_PATH);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
