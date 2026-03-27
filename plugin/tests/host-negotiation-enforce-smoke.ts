import { createHostPluginDescriptor } from "../runtime/plugin-entry";
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
  const advisory = createHostPluginDescriptor({
    supermemoryClient: new FakeSupermemoryClient(),
    hostExpectation: {
      protocolVersion: "host-plugin.v2",
      requiredFeatures: ["streaming-responses"],
    },
    negotiationPolicy: { mode: "advisory" },
  });

  let enforceError: string | null = null;
  try {
    createHostPluginDescriptor({
      supermemoryClient: new FakeSupermemoryClient(),
      hostExpectation: {
        protocolVersion: "host-plugin.v2",
        requiredFeatures: ["streaming-responses"],
      },
      negotiationPolicy: { mode: "enforce" },
    });
  } catch (err: any) {
    enforceError = err?.message || String(err);
  }

  console.log(JSON.stringify({
    advisoryDescriptorId: advisory.id,
    enforceError,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
