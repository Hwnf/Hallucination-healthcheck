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

  const registered = await registerHostPluginFromManifest(
    registry,
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    {
      supermemoryClient: new FakeSupermemoryClient(),
      hostPlugin: { id: "control-plugin" },
      registryCache: makeRegistryCache(true),
    },
  );

  const disabled = registry.disable("control-plugin");

  await reconcileHostPluginFromManifest(
    registry,
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    {
      supermemoryClient: new FakeSupermemoryClient(),
      hostPlugin: { id: "control-plugin" },
      pluginId: "control-plugin",
      registryCache: makeRegistryCache(false),
    },
  );
  const afterReconcileWhileDisabled = registry.get("control-plugin");

  const enabled = registry.enable("control-plugin");

  console.log(JSON.stringify({
    registered,
    disabled,
    afterReconcileWhileDisabled,
    enabled,
    registry: registry.list(),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
