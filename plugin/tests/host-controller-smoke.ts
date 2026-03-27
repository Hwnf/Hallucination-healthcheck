import { createHostPluginDescriptor } from "../runtime/plugin-entry";
import { HostExecutionController } from "../runtime/host-controller";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
import type { HostPluginRecord } from "../runtime/host-registry";

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
  const descriptor = createHostPluginDescriptor({
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: { id: "controller-plugin", version: "0.7.0-test" },
  });

  const degradedRecord: HostPluginRecord = {
    id: descriptor.id,
    version: descriptor.version,
    state: "degraded",
    manifest: {
      schemaVersion: "openclaw.plugin-manifest.v1",
      id: descriptor.id,
      displayName: descriptor.displayName,
      version: descriptor.version,
      entry: "plugin/runtime/plugin-entry.ts",
      factory: "createHostPluginDescriptor",
      protocolVersion: descriptor.capabilities.protocolVersion,
      capabilities: {
        supportedHooks: descriptor.capabilities.supportedHooks,
        responseEnvelopes: descriptor.capabilities.responseEnvelopes,
        features: descriptor.capabilities.features,
      },
    },
    capabilities: descriptor.capabilities,
    lastNegotiation: null,
    lastHealth: {
      ok: false,
      issues: [{ registry: "agents", path: "agents.json", severity: "error", message: "simulated degraded registry" }],
      loadedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  const controller = new HostExecutionController(descriptor, degradedRecord);

  const pre = await controller.handlePreTurnEvent({
    hook: "preTurn",
    eventId: "evt_controller_pre",
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
    query: "controller pre",
    intent: "active_project",
  });

  const post = await controller.handlePostTurnEvent({
    hook: "postTurn",
    eventId: "evt_controller_post",
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
    candidate: {
      targetScope: "governance",
      targetContainer: "gov_global",
      content: "controller post",
      summary: "controller post",
      confidence: 0.9,
    },
  });

  const health = await controller.handleHealthEvent({
    hook: "health",
    eventId: "evt_controller_health",
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
