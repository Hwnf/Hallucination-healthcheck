import { loadHostPluginFromManifest } from "../runtime/host-loader";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
import type { HostPreTurnEvent, HostPostTurnEvent } from "../runtime/host-events";

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
        memoryId: `loaded_exec_${scope}_${index}`,
        memoryScope: scope,
        visibility: "shared",
        status: "active",
        timestamp: new Date().toISOString(),
        content: `Loaded execution memory from ${scope}`,
        summary: `Loaded execution memory from ${scope}`,
      },
      finalScore: 0.95,
    })) as any;
  }

  async write(record: any) {
    this.writes.push(record);
    return { memoryId: record.memoryId };
  }
}

async function main() {
  const fake = new FakeSupermemoryClient();
  const loaded = await loadHostPluginFromManifest(
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    { supermemoryClient: fake },
  );

  const preEvent: HostPreTurnEvent = {
    hook: "preTurn",
    eventId: "evt_loaded_pre",
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
      conversationId: "conv_loaded_exec",
    },
    query: "loaded descriptor execution",
    intent: "active_project",
  };

  const postEvent: HostPostTurnEvent = {
    hook: "postTurn",
    eventId: "evt_loaded_post",
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
      content: "Loaded descriptor governance write",
      summary: "Loaded descriptor governance write",
      confidence: 0.96,
    },
  };

  const pre = await loaded.descriptor.execute.handlePreTurnEvent(preEvent);
  const post = await loaded.descriptor.execute.handlePostTurnEvent(postEvent);
  const health = await loaded.descriptor.execute.handleHealthEvent({
    hook: "health",
    eventId: "evt_loaded_health",
    source: "openclaw-host",
    receivedAt: new Date().toISOString(),
    runtimeInput: {},
  });

  console.log(JSON.stringify({
    manifestId: loaded.manifest.id,
    descriptorId: loaded.descriptor.id,
    preOk: pre.ok,
    postOk: post.ok,
    healthOk: health.ok,
    preHook: pre.hook,
    postHook: post.hook,
    writesCount: fake.writes.length,
    preProvenance: pre.provenance ?? null,
    postProvenance: post.provenance ?? null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
