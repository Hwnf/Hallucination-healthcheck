import { registerHostPluginFromManifest } from "../runtime/host-registration";
import { HostPluginRegistry } from "../runtime/host-registry";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
import { readFile, rm } from "node:fs/promises";

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
  const snapshotPath = "/root/.openclaw/workspace/plugin/tests/fixtures/host-registry.snapshot.json";

  const registered = await registerHostPluginFromManifest(
    registry,
    "/root/.openclaw/workspace/plugin/openclaw-plugin.manifest.json",
    {
      supermemoryClient: new FakeSupermemoryClient(),
      hostPlugin: { id: "persisted-plugin" },
      expectation: {
        protocolVersion: "host-plugin.v1",
        requiredFeatures: ["host-event-envelopes"],
      },
    },
  );

  const disabled = registry.disable("persisted-plugin");
  const saved = await registry.saveToFile(snapshotPath);
  const raw = JSON.parse(await readFile(snapshotPath, "utf8"));
  const restored = await HostPluginRegistry.fromFile(snapshotPath);

  console.log(JSON.stringify({
    registered,
    disabled,
    saved,
    raw,
    restored: restored.list(),
  }, null, 2));

  await rm(snapshotPath, { force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
