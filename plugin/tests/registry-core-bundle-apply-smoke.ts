import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { RegistryLoader } from "../registries/registry-loader";
import {
  applySelectedRegistryBundleSnapshot,
  loadRegistryBundleSnapshot,
  saveRegistryBundleSnapshot,
} from "../registries/registry-snapshot";

const PROJECTS_PATH = "/root/.openclaw/workspace/agents/registry/projects.json";
const MEMORY_SPACES_PATH = "/root/.openclaw/workspace/agents/registry/memory_spaces.json";
const POLICIES_PATH = "/root/.openclaw/workspace/agents/registry/policies.json";
const PROJECTS_BACKUP = "/root/.openclaw/workspace/plugin/tests/fixtures/projects.core-bundle-apply.backup.json";
const MEMORY_SPACES_BACKUP = "/root/.openclaw/workspace/plugin/tests/fixtures/memory-spaces.core-bundle-apply.backup.json";
const POLICIES_BACKUP = "/root/.openclaw/workspace/plugin/tests/fixtures/policies.core-bundle-apply.backup.json";
const SNAPSHOT_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/registry-core-bundle.apply.snapshot.json";

async function main() {
  await copyFile(PROJECTS_PATH, PROJECTS_BACKUP);
  await copyFile(MEMORY_SPACES_PATH, MEMORY_SPACES_BACKUP);
  await copyFile(POLICIES_PATH, POLICIES_BACKUP);

  try {
    const loader = new RegistryLoader();
    const bundle = await loader.loadAll();
    await saveRegistryBundleSnapshot(SNAPSHOT_PATH, bundle);

    const rawSnapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
    rawSnapshot.bundle.projects[0].status = "active";
    rawSnapshot.bundle.projects[0].lifecycle_state = "active";
    rawSnapshot.bundle.memorySpaces[0].retrieval_rank = 42;
    rawSnapshot.bundle.policies[0].status = "disabled";
    await writeFile(SNAPSHOT_PATH, JSON.stringify(rawSnapshot, null, 2) + "\n", "utf8");

    const snapshot = await loadRegistryBundleSnapshot(SNAPSHOT_PATH);
    const applyResult = await applySelectedRegistryBundleSnapshot(snapshot, ["companies", "agents", "projects", "memorySpaces", "policies"]);

    const projects = JSON.parse(await readFile(PROJECTS_PATH, "utf8"));
    const memorySpaces = JSON.parse(await readFile(MEMORY_SPACES_PATH, "utf8"));
    const policies = JSON.parse(await readFile(POLICIES_PATH, "utf8"));

    console.log(JSON.stringify({
      applyResult,
      projectStatus: projects[0]?.status ?? null,
      projectLifecycleState: projects[0]?.lifecycle_state ?? null,
      firstMemoryRetrievalRank: memorySpaces[0]?.retrieval_rank ?? null,
      firstPolicyStatus: policies[0]?.status ?? null,
    }, null, 2));
  } finally {
    await writeFile(PROJECTS_PATH, await readFile(PROJECTS_BACKUP, "utf8"), "utf8");
    await writeFile(MEMORY_SPACES_PATH, await readFile(MEMORY_SPACES_BACKUP, "utf8"), "utf8");
    await writeFile(POLICIES_PATH, await readFile(POLICIES_BACKUP, "utf8"), "utf8");
    await rm(SNAPSHOT_PATH, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
