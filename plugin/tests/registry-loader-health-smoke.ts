import { writeFile, readFile, copyFile } from "node:fs/promises";
import { RegistryLoader } from "../registries/registry-loader";

const PROMOTIONS_PATH = "/root/.openclaw/workspace/agents/registry/promotions.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/promotions.loader-health.backup.json";

async function main() {
  await copyFile(PROMOTIONS_PATH, BACKUP_PATH);

  try {
    await writeFile(PROMOTIONS_PATH, JSON.stringify({ not: "an-array" }, null, 2) + "\n", "utf8");

    const loader = new RegistryLoader();
    const bundle = await loader.loadAll();
    const health = loader.health();

    console.log(JSON.stringify({
      promotionsLength: bundle.promotions.length,
      health,
    }, null, 2));
  } finally {
    const original = await readFile(BACKUP_PATH, "utf8");
    await writeFile(PROMOTIONS_PATH, original, "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
