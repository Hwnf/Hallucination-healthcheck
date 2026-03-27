import { createPluginRuntime } from "../runtime/plugin-entry";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  public writes: any[] = [];

  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async search(request: any) {
    return (request.scopes || []).slice(0, 2).map((scope: string, index: number) => ({
      record: {
        schemaVersion: "2.0",
        memoryId: `mem_${scope}_${index}`,
        memoryScope: scope,
        visibility: "shared",
        status: "active",
        timestamp: new Date().toISOString(),
        content: `Runtime memory from ${scope}`,
        summary: `Runtime memory from ${scope}`,
      },
      finalScore: 0.9 - index * 0.1,
    })) as any;
  }

  async write(record: any) {
    this.writes.push(record);
    return { memoryId: record.memoryId };
  }
}

async function main() {
  const fake = new FakeSupermemoryClient();
  const runtime = createPluginRuntime({ supermemoryClient: fake });

  const pre = await runtime.preTurn({
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      companyId: "company_web",
      projectId: "project_supermemory_fork",
      conversationId: "conv_plugin_runtime",
    },
    query: "runtime plugin test",
    intent: "active_project",
  });

  const post = await runtime.postTurn({
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      companyId: "company_web",
      projectId: "project_supermemory_fork",
    },
    candidate: {
      targetScope: "project",
      targetContainer: "project_supermemory_fork",
      content: "Plugin runtime write test",
      summary: "Plugin runtime write test",
      confidence: 0.9,
    },
  });

  const health = await runtime.health();

  console.log(JSON.stringify({
    hasPreTurn: typeof runtime.preTurn === "function",
    hasPostTurn: typeof runtime.postTurn === "function",
    pre,
    post,
    health,
    writesCount: fake.writes.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
