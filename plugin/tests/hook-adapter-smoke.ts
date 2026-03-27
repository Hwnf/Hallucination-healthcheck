import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultAclEngine } from "../policy/acl-engine";
import { DefaultScopeRouter } from "../policy/scope-router";
import { DefaultRetrievalGate } from "../policy/retrieval-gate";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
import { PreTurnHook } from "../runtime/hook-pre-turn";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async search() {
    return [
      {
        record: {
          schemaVersion: "2.0",
          memoryId: "mem_test_1",
          memoryScope: "project",
          visibility: "shared",
          status: "active",
          timestamp: new Date().toISOString(),
          content: "Project memory from adapter-enriched flow",
          summary: "Project memory from adapter-enriched flow",
        },
        finalScore: 0.9,
      },
    ] as any;
  }
}

async function main() {
  const hook = new PreTurnHook(
    new DefaultContextResolver(),
    new DefaultScopeRouter(),
    new DefaultRetrievalGate(),
    new FakeSupermemoryClient(),
    new DefaultAclEngine(),
  );

  const result = await hook.run({
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      conversationId: "conv_hook_adapter",
    },
    query: "project memory",
    intent: "active_project",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
