import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { RegistryLoader } from "../registries/registry-loader";
import {
  applySelectedRegistryBundleSnapshot,
  loadRegistryBundleSnapshot,
  saveRegistryBundleSnapshot,
} from "../registries/registry-snapshot";

const PROMOTIONS_PATH = "/root/.openclaw/workspace/agents/registry/promotions.json";
const PROMOTIONS_BACKUP = "/root/.openclaw/workspace/plugin/tests/fixtures/promotions.bundle-apply.backup.json";
const SNAPSHOT_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/registry-bundle.apply.snapshot.json";

async function main() {
  await copyFile(PROMOTIONS_PATH, PROMOTIONS_BACKUP);

  try {
    const loader = new RegistryLoader();
    const bundle = await loader.loadAll();
    await saveRegistryBundleSnapshot(SNAPSHOT_PATH, bundle);

    const rawSnapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
    rawSnapshot.bundle.promotions = [
      {
        promotion_id: "promo_snapshot_apply_test",
        from_memory_id: "project_supermemory_fork",
        from_scope: "project",
        to_scope: "company",
        to_memory_id: "company_web",
        canonical_key: "snapshot-apply-test",
        requested_by: "agent_orchestrator",
        approved_by: "agent_orchestrator",
        reason: "test snapshot apply",
        status: "approved",
        derived_from: ["project_supermemory_fork"],
        timestamp: new Date().toISOString(),
      },
    ];
    await writeFile(SNAPSHOT_PATH, JSON.stringify(rawSnapshot, null, 2) + "\n", "utf8");

    const snapshot = await loadRegistryBundleSnapshot(SNAPSHOT_PATH);
    const applyResult = await applySelectedRegistryBundleSnapshot(snapshot, ["companies", "agents", "projects", "promotions"]);
    const promotions = JSON.parse(await readFile(PROMOTIONS_PATH, "utf8"));

    console.log(JSON.stringify({
      applyResult,
      promotionsLength: promotions.length,
      firstPromotionId: promotions[0]?.promotion_id ?? null,
      firstCanonicalKey: promotions[0]?.canonical_key ?? null,
    }, null, 2));
  } finally {
    const promotionsBackup = await readFile(PROMOTIONS_BACKUP, "utf8");
    await writeFile(PROMOTIONS_PATH, promotionsBackup, "utf8");
    await rm(SNAPSHOT_PATH, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
