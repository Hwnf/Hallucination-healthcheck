import { readFile } from "node:fs/promises";
import { DefaultArchiveManager } from "../operations/archive-manager";

async function main() {
  const manager = new DefaultArchiveManager();
  const manifest = {
    archiveMemoryId: manager.makeArchiveMemoryId("project_supermemory_fork"),
    projectId: "project_supermemory_fork",
    archivedAt: new Date().toISOString(),
    archivedBy: "agent_orchestrator",
    closeoutBatch: `closeout_test_${Date.now()}`,
    projectStatusAtClose: "completed",
    summaryRef: "archive://project_supermemory_fork/summary",
    decisionIndexRef: "archive://project_supermemory_fork/decisions",
    artifactIndexRef: "archive://project_supermemory_fork/artifacts",
    experienceExtractions: ["project_supermemory_fork:closeout:lesson"],
    promotionOutputs: {
      company: ["project_supermemory_fork:closeout:summary"],
      governance: [],
      user: [],
      experience: ["project_supermemory_fork:closeout:lesson"],
    },
    accessPolicy: "cold_storage_default",
    sensitivity: "internal" as const,
  };

  await manager.recordArchive(manifest);
  const manifestPath = manager.manifestPath("project_supermemory_fork");
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw);

  console.log(JSON.stringify({
    archiveMemoryId: manifest.archiveMemoryId,
    manifestPath,
    manifestProjectId: parsed.projectId,
    accessPolicy: parsed.accessPolicy,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
