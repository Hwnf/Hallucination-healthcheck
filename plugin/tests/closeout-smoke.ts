import { DefaultCloseoutManager } from "../operations/closeout-manager";

async function main() {
  const manager = new DefaultCloseoutManager();
  const result = await manager.closeProject("project_supermemory_fork", {
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    userId: "123",
    conversationId: "conv_closeout",
    companyId: "company_web",
    projectId: "project_supermemory_fork",
    provider: "discord",
    channel: "discord",
    lifecycleState: "completed",
    roles: [],
    capabilities: [],
    nowIso: new Date().toISOString(),
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
