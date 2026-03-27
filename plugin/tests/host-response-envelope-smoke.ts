import { createHostPluginDescriptor } from "../runtime/plugin-entry";
import type { HostPostTurnEvent, HostPreTurnEvent } from "../runtime/host-events";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
import type { PaperclipClient } from "../integrations/paperclip-client";

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

class FailingPaperclipClient implements PaperclipClient {
  async resolveState(): Promise<any> {
    throw new Error("simulated paperclip api failure");
  }
}

async function main() {
  const descriptor = createHostPluginDescriptor({
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: { id: "resp-envelope-plugin", version: "0.2.0-test" },
    config: {
      paperclip: {
        mode: "api",
        fallbackToRegistryOnError: true,
      },
    },
    // @ts-ignore intentional injection via runtime options path
    paperclip: {
      client: new FailingPaperclipClient(),
      mode: "api",
      fallbackToRegistryOnError: true,
      cacheTtlMs: 30000,
    },
  } as any);

  const preEvent: HostPreTurnEvent = {
    hook: "preTurn",
    eventId: "evt_pre_resp",
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
    query: "response envelope pre",
    intent: "active_project",
  };

  const postEvent: HostPostTurnEvent = {
    hook: "postTurn",
    eventId: "evt_post_resp",
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
      lifecycleState: "active",
    },
    candidate: {
      targetScope: "governance",
      targetContainer: "gov_global",
      content: "Response envelope governance write",
      summary: "Response envelope governance write",
      confidence: 0.95,
    },
  };

  const pre = await descriptor.execute.handlePreTurnEvent(preEvent);
  const post = await descriptor.execute.handlePostTurnEvent(postEvent);
  const health = await descriptor.execute.handleHealthEvent({
    hook: "health",
    eventId: "evt_health_resp",
    source: "openclaw-host",
    receivedAt: new Date().toISOString(),
    runtimeInput: {},
  });

  console.log(JSON.stringify({ pre, post, health, hookContract: descriptor.hooks }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
