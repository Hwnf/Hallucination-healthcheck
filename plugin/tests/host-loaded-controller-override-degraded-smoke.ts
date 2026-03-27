import { registerHostPluginFromManifest } from "../runtime/host-registration";
import { reconcileHostPluginFromManifest } from "../runtime/host-reconcile";
import { loadHostPluginFromManifest } from "../runtime/host-loader";
import { HostPluginRegistry } from "../runtime/host-registry";
import { HostExecutionController } from "../runtime/host-controller";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
import type { PaperclipClient } from "../integrations/paperclip-client";
import type { HostPostTurnEvent } from "../runtime/host-events";

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
    hostPlugin: { id: "loaded-controller-override-plugin" },
    registryCache: makeRegistryCache(true),
  });

  const degradedRecord = await reconcileHostPluginFromManifest(registry, manifestPath, {
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: { id: "loaded-controller-override-plugin" },
    pluginId: "loaded-controller-override-plugin",
    registryCache: makeRegistryCache(false),
  });

  const loaded = await loadHostPluginFromManifest(manifestPath, {
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: { id: "loaded-controller-override-plugin" },
    registryCache: makeRegistryCache(false),
    config: {
      paperclip: {
        mode: "api",
        sourceOfTruth: "api-only",
        fallbackToRegistryOnError: false,
      },
    },
    // @ts-ignore intentional runtime injection
    paperclip: {
      client: new FailingPaperclipClient(),
      mode: "api",
      sourceOfTruth: "api-only",
      fallbackToRegistryOnError: false,
      cacheTtlMs: 30000,
    },
  } as any);

  const controller = new HostExecutionController(loaded.descriptor, degradedRecord, {
    overrides: {
      degraded: {
        postTurn: { allowed: true, reason: "lenient host allows postTurn while degraded" },
      },
    },
  });

  const postEvent: HostPostTurnEvent = {
    hook: "postTurn",
    eventId: "evt_loaded_ctrl_override_post",
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
      content: "loaded controller override degraded post",
      summary: "loaded controller override degraded post",
      confidence: 0.93,
    },
  };

  const post = await controller.handlePostTurnEvent(postEvent);

  console.log(JSON.stringify({
    degradedState: degradedRecord.state,
    postOk: post.ok,
    postPayload: post.payload,
    postProvenance: post.provenance ?? null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
