import { readFile, writeFile, copyFile } from "node:fs/promises";
import { DefaultCloseoutManager } from "../operations/closeout-manager";
import { DefaultArchiveManager } from "../operations/archive-manager";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const FIXTURE_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/multi-agent-agents.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/agents.backup.json";

async function main() {
  await copyFile(AGENTS_PATH, BACKUP_PATH);
  await copyFile(FIXTURE_PATH, AGENTS_PATH);

  try {
    const closeout = new DefaultCloseoutManager();
    const archive = new DefaultArchiveManager();

    const result = await closeout.closeProject("project_supermemory_fork", {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      userId: "436403292009005066",
      conversationId: "conv_multi_closeout",
      companyId: "company_web",
      projectId: "project_supermemory_fork",
      provider: "discord",
      channel: "discord",
      lifecycleState: "completed",
      roles: [],
      capabilities: [],
      nowIso: new Date().toISOString(),
    });

    const raw = await readFile(AGENTS_PATH, "utf8");
    const agents = JSON.parse(raw);
    const builder = agents.find((a: any) => a.agent_id === "agent_builder");
    const reviewer = agents.find((a: any) => a.agent_id === "agent_reviewer");
    const manager = await archive.canReadArchive(
      {
        agentId: "agent_manager",
        agentName: "Manager",
        agentKind: "agent",
        provider: "discord",
        channel: "discord",
        nowIso: new Date().toISOString(),
        roles: ["manager"],
        capabilities: [],
      },
      "project_supermemory_fork",
    );

    console.log(JSON.stringify({
      result,
      builderAssignedProjects: builder?.assigned_projects,
      reviewerAssignedProjects: reviewer?.assigned_projects,
      builderDenies: builder?.denies,
      reviewerDenies: reviewer?.denies,
      managerArchiveAccess: manager,
    }, null, 2));
  } finally {
    await copyFile(BACKUP_PATH, AGENTS_PATH);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
