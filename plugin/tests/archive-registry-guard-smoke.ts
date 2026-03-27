import { writeFile, readFile, copyFile } from "node:fs/promises";
import { DefaultArchiveManager } from "../operations/archive-manager";

const ARCHIVES_PATH = "/root/.openclaw/workspace/agents/registry/archives.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/archives.guard.backup.json";

async function main() {
  await copyFile(ARCHIVES_PATH, BACKUP_PATH);

  try {
    await writeFile(ARCHIVES_PATH, JSON.stringify({ broken: true }, null, 2) + "\n", "utf8");
    const manager = new DefaultArchiveManager();
    let error: string | null = null;

    try {
      await manager.recordArchive({
        archiveMemoryId: manager.makeArchiveMemoryId("project_supermemory_fork"),
        projectId: "project_supermemory_fork",
        archivedAt: new Date().toISOString(),
        archivedBy: "agent_orchestrator",
        closeoutBatch: `closeout_test_${Date.now()}`,
        projectStatusAtClose: "completed",
        summaryRef: "archive://project_supermemory_fork/summary",
        decisionIndexRef: "archive://project_supermemory_fork/decisions",
        artifactIndexRef: "archive://project_supermemory_fork/artifacts",
        experienceExtractions: [],
        promotionOutputs: { company: [], governance: [], user: [], experience: [] },
        accessPolicy: "cold_storage_default",
        sensitivity: "internal",
      });
    } catch (err: any) {
      error = err?.message || String(err);
    }

    console.log(JSON.stringify({ error }, null, 2));
  } finally {
    const original = await readFile(BACKUP_PATH, "utf8");
    await writeFile(ARCHIVES_PATH, original, "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
