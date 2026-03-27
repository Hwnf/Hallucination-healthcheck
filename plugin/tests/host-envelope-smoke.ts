import { DefaultOpenClawAdapter } from "../integrations/openclaw-adapter";
import type { HostPostTurnEvent, HostPreTurnEvent } from "../runtime/host-events";
import { createHostPluginDescriptor } from "../runtime/plugin-entry";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async search() {
    return [] as any;
  }

  async write(record: any) {
    return { memoryId: record.memoryId };
  }
}

async function main() {
  const adapter = new DefaultOpenClawAdapter();
  const preEvent: HostPreTurnEvent = {
    hook: "preTurn",
    eventId: "evt_pre_1",
    source: "openclaw-host",
    receivedAt: new Date().toISOString(),
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      projectId: "project_supermemory_fork",
      companyId: "company_web",
    },
    query: "host envelope pre",
    intent: "active_project",
  };

  const postEvent: HostPostTurnEvent = {
    hook: "postTurn",
    eventId: "evt_post_1",
    source: "openclaw-host",
    receivedAt: new Date().toISOString(),
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      projectId: "project_supermemory_fork",
      companyId: "company_web",
      lifecycleState: "active",
    },
    candidate: {
      targetScope: "project",
      targetContainer: "project_supermemory_fork",
      content: "Host envelope post",
      summary: "Host envelope post",
      confidence: 0.8,
    },
  };

  const preInput = adapter.hostPreTurnToHookInput(preEvent);
  const postInput = adapter.hostPostTurnToHookInput(postEvent);
  const descriptor = createHostPluginDescriptor({ supermemoryClient: new FakeSupermemoryClient() });

  console.log(JSON.stringify({
    preInput,
    postInput,
    hookContract: descriptor.hooks,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
