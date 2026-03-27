import { readFile, rm } from "node:fs/promises";
import { RegistryLoader } from "../registries/registry-loader";
import {
  importRegistryBundleSnapshot,
  loadRegistryBundleSnapshot,
  saveRegistryBundleSnapshot,
} from "../registries/registry-snapshot";

async function main() {
  const loader = new RegistryLoader();
  const bundle = await loader.loadAll();
  const snapshotPath = "/root/.openclaw/workspace/plugin/tests/fixtures/registry-bundle.snapshot.json";

  try {
    const saved = await saveRegistryBundleSnapshot(snapshotPath, bundle);
    const raw = JSON.parse(await readFile(snapshotPath, "utf8"));
    const loaded = await loadRegistryBundleSnapshot(snapshotPath);
    const restored = importRegistryBundleSnapshot(loaded);

    console.log(JSON.stringify({
      savedSchemaVersion: saved.schemaVersion,
      savedItemSchemaVersion: saved.itemSchemaVersion,
      rawSchemaVersion: raw.schemaVersion,
      loadedSchemaVersion: loaded.schemaVersion,
      projectsLength: restored.projects.length,
      promotionsLength: restored.promotions.length,
      archivesLength: restored.archives.length,
      matchesProjects: restored.projects.length === bundle.projects.length,
      matchesPromotions: restored.promotions.length === bundle.promotions.length,
      matchesArchives: restored.archives.length === bundle.archives.length,
    }, null, 2));
  } finally {
    await rm(snapshotPath, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
