import { createHostPluginDescriptor } from "../runtime/plugin-entry";
import { createHostRegistrationManifest } from "../runtime/host-manifest";
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
      id: "manifest-plugin",
      displayName: "Manifest Plugin",
      version: "0.6.0-test",
    },
  });

  const manifest = createHostRegistrationManifest(descriptor);

  console.log(JSON.stringify({ manifest }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
