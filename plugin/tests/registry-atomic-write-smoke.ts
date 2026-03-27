import { readFile, writeFile, copyFile } from "node:fs/promises";
import { RegistryWriter } from "../registries/registry-writer";

const PROMOTIONS_PATH = "/root/.openclaw/workspace/agents/registry/promotions.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/promotions.atomic-write.backup.json";

async function main() {
  await copyFile(PROMOTIONS_PATH, BACKUP_PATH);

  try {
    const original = await readFile(PROMOTIONS_PATH, "utf8");
    const writer = new RegistryWriter({
      async mkdir() {},
      async writeFile() {
        throw new Error("simulated temp write failure");
      },
      async rename() {
        throw new Error("rename should not run after temp write failure");
      },
      async rm() {},
    });

    let error: string | null = null;
    try {
      await writer.writePromotions([
        {
          promotion_id: "promo_atomic_test",
          from_memory_id: "project_supermemory_fork",
          from_scope: "project",
          to_scope: "company",
          to_memory_id: "company_web",
          canonical_key: "atomic-write-test",
          requested_by: "agent_orchestrator",
          reason: "test atomic writer",
          status: "approved",
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      error = err?.message || String(err);
    }

    const after = await readFile(PROMOTIONS_PATH, "utf8");
    console.log(JSON.stringify({
      error,
      filePreserved: original === after,
      originalLength: original.length,
      afterLength: after.length,
    }, null, 2));
  } finally {
    const backup = await readFile(BACKUP_PATH, "utf8");
    await writeFile(PROMOTIONS_PATH, backup, "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
