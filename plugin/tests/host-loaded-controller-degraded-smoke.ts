import { registerHostPluginFromManifest } from "../runtime/host-registration";
import { reconcileHostPluginFromManifest } from "../runtime/host-reconcile";
import { loadHostPluginFromManifest } from "../runtime/host-loader";
import { HostPluginRegistry } from "../runtime/host-registry";
import { HostExecutionController } from "../runtime/host-controller";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
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

function makeRegistryCache(ok: boolean) {
  return {
    async get() {
      return {
        agents: [],
        companies: [],
        projects: [],
        memorySpaces: [],
        promotions: [],
        archives: [],
        experienceIndex: [],
        policies: [],
        contradictions: [],
      };
    },
    health() {
      return {
        ok,
        issues: ok
          ? []
          : [{ registry: "agents", path: "agents.json", severity: "error", message: "simulated degraded registry" }],
        loadedAt: new Date().toISOString(),
      };
    },
    clear() {},
  } as any;
}

async function main() {
  const registry = new HostPluginRegistry();
  const manifestPath = "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json";

  await registerHostPluginFromManifest(registry, manifestPath, {
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: { id: "loaded-controller-plugin" },
    registryCache: makeRegistryCache(true),
  });

  const degradedRecord = await reconcileHostPluginFromManifest(registry, manifestPath, {
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: { id: "loaded-controller-plugin" },
    pluginId: "loaded-controller-plugin",
    registryCache: makeRegistryCache(false),
  });

  const loaded = await loadHostPluginFromManifest(manifestPath, {
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: { id: "loaded-controller-plugin" },
    registryCache: makeRegistryCache(false),
  });

  const controller = new HostExecutionController(loaded.descriptor, degradedRecord);

  const preEvent: HostPreTurnEvent = {
    hook: "preTurn",
    eventId: "evt_loaded_ctrl_pre",
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
    query: "loaded controller degraded pre",
    intent: "active_project",
  };

  const postEvent: HostPostTurnEvent = {
    hook: "postTurn",
    eventId: "evt_loaded_ctrl_post",
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
      content: "loaded controller degraded post",
      summary: "loaded controller degraded post",
      confidence: 0.91,
    },
  };

  const pre = await controller.handlePreTurnEvent(preEvent);
  const post = await controller.handlePostTurnEvent(postEvent);
  const health = await controller.handleHealthEvent({
    hook: "health",
    eventId: "evt_loaded_ctrl_health",
    source: "openclaw-host",
    receivedAt: new Date().toISOString(),
    runtimeInput: {},
  });

  console.log(JSON.stringify({
    degradedState: degradedRecord.state,
    preOk: pre.ok,
    postOk: post.ok,
    healthOk: health.ok,
    postPayload: post.payload,
    healthPayload: health.payload,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
