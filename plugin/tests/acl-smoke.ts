import { DefaultAclEngine } from "../policy/acl-engine";

async function main() {
  const acl = new DefaultAclEngine();

  const orchestrator = await acl.can(
    {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      nowIso: new Date().toISOString(),
    },
    "read",
    "gov_global",
  );

  const unknownAgent = await acl.can(
    {
      agentId: "agent_unknown",
      agentName: "Unknown",
      agentKind: "agent",
      provider: "discord",
      channel: "discord",
      nowIso: new Date().toISOString(),
    },
    "read",
    "archive_project_supermemory_fork",
  );

  console.log(JSON.stringify({ orchestrator, unknownAgent }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
