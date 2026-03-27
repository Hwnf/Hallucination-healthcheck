import { createHostPluginDescriptor } from "../runtime/plugin-entry";
import type { HostPostTurnEvent, HostPreTurnEvent } from "../runtime/host-events";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  public writes: any[] = [];

  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async search(request: any) {
    return (request.scopes || []).slice(0, 1).map((scope: string, index: number) => ({
      record: {
        schemaVersion: "2.0",
        memoryId: `mem_${scope}_${index}`,
        memoryScope: scope,
        visibility: "shared",
        status: "active",
        timestamp: new Date().toISOString(),
        content: `Lifecycle executor memory from ${scope}`,
        summary: `Lifecycle executor memory from ${scope}`,
      },
      finalScore: 0.9,
    })) as any;
  }

  async write(record: any) {
    this.writes.push(record);
    return { memoryId: record.memoryId };
  }
}

async function main() {
  const descriptor = createHostPluginDescriptor({ supermemoryClient: new FakeSupermemoryClient() });

  const preEvent: HostPreTurnEvent = {
    hook: "preTurn",
    eventId: "evt_pre_exec",
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
      conversationId: "conv_host_exec",
    },
    query: "host lifecycle exec",
    intent: "active_project",
  };

  const postEvent: HostPostTurnEvent = {
    hook: "postTurn",
    eventId: "evt_post_exec",
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
      content: "Host lifecycle governance write",
      summary: "Host lifecycle governance write",
      confidence: 0.95,
    },
  };

  const pre = await descriptor.execute.handlePreTurnEvent(preEvent);
  const post = await descriptor.execute.handlePostTurnEvent(postEvent);
  const health = await descriptor.execute.handleHealthEvent({
    hook: "health",
    eventId: "evt_health_exec",
    source: "openclaw-host",
    receivedAt: new Date().toISOString(),
    runtimeInput: {},
  });

  console.log(JSON.stringify({ pre, post, health }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
