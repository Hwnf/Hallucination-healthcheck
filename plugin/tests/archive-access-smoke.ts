import { DefaultArchiveManager } from "../operations/archive-manager";

async function main() {
  const manager = new DefaultArchiveManager();

  const orchestrator = await manager.canReadArchive(
    {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      nowIso: new Date().toISOString(),
      roles: [],
      capabilities: [],
    },
    "project_supermemory_fork",
  );

  const ordinary = await manager.canReadArchive(
    {
      agentId: "agent_basic",
      agentName: "Basic",
      agentKind: "agent",
      provider: "discord",
      channel: "discord",
      nowIso: new Date().toISOString(),
      roles: ["worker"],
      capabilities: [],
    },
    "project_supermemory_fork",
  );

  const managerRole = await manager.canReadArchive(
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

  console.log(JSON.stringify({ orchestrator, ordinary, managerRole }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
