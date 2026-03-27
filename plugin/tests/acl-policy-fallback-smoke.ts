import { readFile, writeFile, copyFile } from "node:fs/promises";
import { DefaultAclEngine } from "../policy/acl-engine";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/agents.policy-fallback.backup.json";

async function main() {
  await copyFile(AGENTS_PATH, BACKUP_PATH);

  try {
    const raw = await readFile(AGENTS_PATH, "utf8");
    const agents = JSON.parse(raw);

    agents.push({
      agent_id: "agent_policy_test",
      display_name: "Policy Test",
      status: "active",
      capabilities: [],
      assigned_projects: ["project_supermemory_fork"],
      private_memory_id: "agent_policy_test_private",
      experience_file: "agents/experience/policy-test.md",
      lifecycle_state: "active",
      specialization: "test",
      memory_permissions: { read: [], write: [] },
      grants: [],
      denies: [],
      escalation_rights: false,
      schema_version: "2.0"
    });

    agents.push({
      agent_id: "agent_operative_test",
      display_name: "Operative Test",
      status: "active",
      capabilities: [],
      assigned_projects: [],
      private_memory_id: "agent_operative_test_private",
      experience_file: "agents/experience/operative-test.md",
      lifecycle_state: "active",
      specialization: "test",
      memory_permissions: { read: [], write: [] },
      grants: [],
      denies: [],
      escalation_rights: false,
      schema_version: "2.0"
    });

    await writeFile(AGENTS_PATH, JSON.stringify(agents, null, 2) + "\n", "utf8");

    const acl = new DefaultAclEngine();

    const companyRead = await acl.can(
      {
        agentId: "agent_policy_test",
        agentName: "Policy Test",
        agentKind: "agent",
        provider: "discord",
        channel: "discord",
        companyId: "company_web",
        projectId: "project_supermemory_fork",
        nowIso: new Date().toISOString(),
        roles: [],
        capabilities: [],
      },
      "read",
      "company_web",
    );

    const projectWrite = await acl.can(
      {
        agentId: "agent_policy_test",
        agentName: "Policy Test",
        agentKind: "agent",
        provider: "discord",
        channel: "discord",
        companyId: "company_web",
        projectId: "project_supermemory_fork",
        nowIso: new Date().toISOString(),
        roles: [],
        capabilities: [],
      },
      "write",
      "project_supermemory_fork",
    );

    const governanceRead = await acl.can(
      {
        agentId: "agent_operative_test",
        agentName: "Operative Test",
        agentKind: "agent",
        provider: "discord",
        channel: "discord",
        nowIso: new Date().toISOString(),
        roles: ["operative"],
        capabilities: [],
      },
      "read",
      "gov_global",
    );

    console.log(JSON.stringify({ companyRead, projectWrite, governanceRead }, null, 2));
  } finally {
    await copyFile(BACKUP_PATH, AGENTS_PATH);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
