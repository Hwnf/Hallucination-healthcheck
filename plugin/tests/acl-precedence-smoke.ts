import { readFile, writeFile, copyFile } from "node:fs/promises";
import { DefaultAclEngine } from "../policy/acl-engine";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/agents.precedence.backup.json";

async function main() {
  await copyFile(AGENTS_PATH, BACKUP_PATH);

  try {
    const raw = await readFile(AGENTS_PATH, "utf8");
    const agents = JSON.parse(raw);

    agents.push({
      agent_id: "agent_acl_test",
      display_name: "ACL Test",
      status: "active",
      capabilities: [],
      assigned_projects: [],
      private_memory_id: "agent_acl_test_private",
      experience_file: "agents/experience/acl-test.md",
      lifecycle_state: "active",
      specialization: "test",
      memory_permissions: {
        read: ["project_supermemory_fork"]
      },
      grants: [
        {
          grant_id: "grant_allow_project",
          subject_type: "agent",
          subject_id: "agent_acl_test",
          resource_id: "project_supermemory_fork",
          actions: ["read"],
          effect: "allow",
          reason: "test allow",
          granted_by: "agent_orchestrator",
          created_at: "2026-03-25T03:00:00Z",
          constraints: { projectId: "project_supermemory_fork" }
        }
      ],
      denies: [
        {
          grant_id: "deny_same_resource",
          resource_id: "project_supermemory_fork",
          actions: ["read"],
          effect: "deny",
          reason: "deny should beat allow",
          granted_by: "agent_orchestrator",
          created_at: "2026-03-25T03:00:00Z"
        }
      ],
      escalation_rights: false,
      schema_version: "2.0"
    });

    await writeFile(AGENTS_PATH, JSON.stringify(agents, null, 2) + "\n", "utf8");

    const acl = new DefaultAclEngine();

    const denied = await acl.can(
      {
        agentId: "agent_acl_test",
        agentName: "ACL Test",
        agentKind: "agent",
        provider: "discord",
        channel: "discord",
        projectId: "project_supermemory_fork",
        nowIso: new Date().toISOString(),
        roles: [],
        capabilities: [],
      },
      "read",
      "project_supermemory_fork",
    );

    console.log(JSON.stringify({ denied }, null, 2));
  } finally {
    await copyFile(BACKUP_PATH, AGENTS_PATH);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
