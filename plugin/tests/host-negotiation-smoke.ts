import { createHostPluginDescriptor } from "../runtime/plugin-entry";
import { negotiateHostPluginDescriptor } from "../runtime/host-negotiation";
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
  const descriptor = createHostPluginDescriptor({
    supermemoryClient: new FakeSupermemoryClient(),
    hostPlugin: {
      id: "negotiation-plugin",
      version: "0.4.0-test",
    },
  });

  const okResult = negotiateHostPluginDescriptor(descriptor, {
    protocolVersion: "host-plugin.v1",
    requiredHooks: ["preTurn", "postTurn"],
    requiredFeatures: ["host-event-envelopes", "paperclip-provenance"],
    requiredResponseEnvelopes: ["HostPreTurnResponse", "HostPostTurnResponse"],
  });

  const failResult = negotiateHostPluginDescriptor(descriptor, {
    protocolVersion: "host-plugin.v2",
    requiredHooks: ["preTurn", "postTurn", "health"],
    requiredFeatures: ["streaming-responses"],
    requiredResponseEnvelopes: ["HostPreTurnResponse", "HostPostTurnResponse", "HostHealthResponse"],
  });

  console.log(JSON.stringify({ okResult, failResult, capabilities: descriptor.capabilities }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
