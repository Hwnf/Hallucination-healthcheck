import { createHostPluginDescriptor } from "../runtime/plugin-entry";
import type { HostPreTurnEvent } from "../runtime/host-events";

async function main() {
  const descriptor = createHostPluginDescriptor({
    supermemoryClient: {
      async search() {
        throw new Error("simulated retrieval failure");
      },
      async write() {
        throw new Error("should not be called");
      },
    } as any,
    hostPlugin: { id: "error-envelope-plugin", version: "0.3.0-test" },
  });

  const preEvent: HostPreTurnEvent = {
    hook: "preTurn",
    eventId: "evt_pre_error",
    source: "openclaw-host",
    receivedAt: new Date().toISOString(),
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      companyId: "company_web",
      projectId: "project_supermemory_fork",
    },
    query: "trigger error envelope",
    intent: "active_project",
  };

  const response = await descriptor.execute.handlePreTurnEvent(preEvent);
  console.log(JSON.stringify({ response, hookContract: descriptor.hooks.preTurn }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
