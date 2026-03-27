import { createHostPluginDescriptor } from "../runtime/plugin-entry";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
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
        content: `Host plugin memory from ${scope}`,
        summary: `Host plugin memory from ${scope}`,
      },
      finalScore: 0.9,
    })) as any;
  }

  async write(record: any) {
    return { memoryId: record.memoryId };
  }
}

async function main() {
  const descriptor = createHostPluginDescriptor({
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: {
      id: "test-blueprint-runtime",
      displayName: "Test Blueprint Runtime",
      version: "0.1.0-test",
    },
  });

  const pre = await descriptor.runtime.preTurn({
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      projectId: "project_supermemory_fork",
      companyId: "company_web",
      conversationId: "conv_host_plugin",
    },
    query: "host plugin test",
    intent: "active_project",
  });

  const health = await descriptor.runtime.health();

  console.log(JSON.stringify({
    descriptorId: descriptor.id,
    displayName: descriptor.displayName,
    version: descriptor.version,
    capabilities: descriptor.capabilities,
    hookNames: {
      preTurn: descriptor.hooks.preTurn.name,
      postTurn: descriptor.hooks.postTurn.name,
      health: descriptor.hooks.health.name,
    },
    preSelectedCount: pre.selectedCount,
    health,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
