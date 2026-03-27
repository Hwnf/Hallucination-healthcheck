import { loadHostPluginFromManifest } from "../runtime/host-loader";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
import type { PaperclipClient } from "../integrations/paperclip-client";
import type { HostPostTurnEvent, HostPreTurnEvent } from "../runtime/host-events";

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
  const loaded = await loadHostPluginFromManifest(
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    {
      supermemoryClient: new FakeSupermemoryClient(),
      config: {
        paperclip: {
          mode: "api",
          sourceOfTruth: "api-only",
          fallbackToRegistryOnError: false,
        },
      },
      // @ts-ignore intentional injection via runtime options path
      paperclip: {
        client: new FailingPaperclipClient(),
        mode: "api",
        sourceOfTruth: "api-only",
        fallbackToRegistryOnError: false,
        cacheTtlMs: 30000,
      },
    } as any,
  );

  const preEvent: HostPreTurnEvent = {
    hook: "preTurn",
    eventId: "evt_loaded_deg_pre",
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
    query: "loaded degraded preturn",
    intent: "active_project",
  };

  const postEvent: HostPostTurnEvent = {
    hook: "postTurn",
    eventId: "evt_loaded_deg_post",
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
      content: "loaded degraded postturn",
      summary: "loaded degraded postturn",
      confidence: 0.92,
    },
  };

  const pre = await loaded.descriptor.execute.handlePreTurnEvent(preEvent);
  const post = await loaded.descriptor.execute.handlePostTurnEvent(postEvent);

  console.log(JSON.stringify({
    manifestId: loaded.manifest.id,
    descriptorId: loaded.descriptor.id,
    preOk: pre.ok,
    postOk: post.ok,
    prePayload: pre.payload,
    postPayload: post.payload,
    preProvenance: pre.provenance ?? null,
    postProvenance: post.provenance ?? null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
