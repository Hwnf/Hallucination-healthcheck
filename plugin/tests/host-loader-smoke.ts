import { loadHostPluginFromManifest } from "../runtime/host-loader";
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
  const loaded = await loadHostPluginFromManifest(
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    { supermemoryClient: new FakeSupermemoryClient() },
  );

  console.log(JSON.stringify({
    manifest: loaded.manifest,
    descriptor: {
      id: loaded.descriptor.id,
      version: loaded.descriptor.version,
      capabilities: loaded.descriptor.capabilities,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
