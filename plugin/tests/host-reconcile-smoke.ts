import { registerHostPluginFromManifest } from "../runtime/host-registration";
import { reconcileHostPluginFromManifest } from "../runtime/host-reconcile";
import { HostPluginRegistry } from "../runtime/host-registry";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

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

  const initial = await registerHostPluginFromManifest(
    registry,
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    {
      supermemoryClient: new FakeSupermemoryClient(),
      hostPlugin: { id: "reconcile-plugin" },
      registryCache: makeRegistryCache(true),
    },
  );

  const degraded = await reconcileHostPluginFromManifest(
    registry,
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    {
      supermemoryClient: new FakeSupermemoryClient(),
      hostPlugin: { id: "reconcile-plugin" },
      pluginId: "reconcile-plugin",
      registryCache: makeRegistryCache(false),
    },
  );

  console.log(JSON.stringify({ initial, degraded, registry: registry.list() }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
