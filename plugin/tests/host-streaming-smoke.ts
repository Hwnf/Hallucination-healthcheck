import { createHostPluginDescriptor } from "../runtime/plugin-entry";
import type { HostPreTurnEvent } from "../runtime/host-events";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async search(request: any) {
    return (request.scopes || []).slice(0, 3).map((scope: string, index: number) => ({
      record: {
        schemaVersion: "2.0",
        memoryId: `mem_${scope}_${index}`,
        memoryScope: scope,
        visibility: "shared",
        status: "active",
        timestamp: new Date().toISOString(),
        content: `Streaming memory from ${scope} line ${index}`,
        summary: `Streaming memory from ${scope} line ${index}`,
      },
      finalScore: 0.95 - index * 0.05,
    })) as any;
  }

  async write(record: any) {
    return { memoryId: record.memoryId };
  }
}

async function main() {
  const descriptor = createHostPluginDescriptor({
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: { id: "streaming-plugin", version: "0.5.0-test" },
  });

  const event: HostPreTurnEvent = {
    hook: "preTurn",
    eventId: "evt_streaming_pre",
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
      conversationId: "conv_streaming_pre",
    },
    query: "streamed preturn",
    intent: "active_project",
  };

  const streamed = await (descriptor.execute as any).handlePreTurnEventChunked(event);

  console.log(JSON.stringify({
    capabilities: descriptor.capabilities,
    streamed,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
