import { registerHostPluginFromManifest } from "../runtime/host-registration";
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

async function main() {
  const registry = new HostPluginRegistry();

  const registered = await registerHostPluginFromManifest(
    registry,
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    {
      supermemoryClient: new FakeSupermemoryClient(),
      hostPlugin: { id: "registered-plugin" },
      expectation: {
        protocolVersion: "host-plugin.v1",
        requiredFeatures: ["host-event-envelopes"],
      },
    },
  );

  const rejected = await registerHostPluginFromManifest(
    registry,
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    {
      supermemoryClient: new FakeSupermemoryClient(),
      hostPlugin: { id: "rejected-plugin" },
      expectation: {
        protocolVersion: "host-plugin.v2",
        requiredFeatures: ["streaming-responses"],
      },
    },
  );

  console.log(JSON.stringify({
    registered,
    rejected,
    registry: registry.list(),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
