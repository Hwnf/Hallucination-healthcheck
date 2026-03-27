import { readFile } from "node:fs/promises";
import { RegistryLoader } from "../registries/registry-loader";
import {
  applySelectedRegistryBundleSnapshot,
  exportRegistryBundleSnapshot,
  planSelectedRegistryBundleApply,
  preflightSelectedRegistryBundleApply,
} from "../registries/registry-snapshot";

async function main() {
  const projectsPath = "/root/.openclaw/workspace/agents/registry/projects.json";
  const memorySpacesPath = "/root/.openclaw/workspace/agents/registry/memory_spaces.json";
  const projectsBefore = await readFile(projectsPath, "utf8");
  const memorySpacesBefore = await readFile(memorySpacesPath, "utf8");

  const loader = new RegistryLoader();
  const bundle = await loader.loadAll();
  const snapshot = exportRegistryBundleSnapshot({
    ...bundle,
    memorySpaces: bundle.memorySpaces.map((item, index) => index === 0 ? { ...item, retrieval_rank: 99 } : item),
  });

  const plan = planSelectedRegistryBundleApply(["memorySpaces"]);
  const preflight = preflightSelectedRegistryBundleApply(["memorySpaces"]);

  let error: string | null = null;
  try {
    await applySelectedRegistryBundleSnapshot(snapshot, ["memorySpaces"]);
  } catch (err: any) {
    error = err?.message || String(err);
  }

  const projectsAfter = await readFile(projectsPath, "utf8");
  const memorySpacesAfter = await readFile(memorySpacesPath, "utf8");

  console.log(JSON.stringify({
    plan,
    preflight,
    error,
    projectsUnchanged: projectsBefore === projectsAfter,
    memorySpacesUnchanged: memorySpacesBefore === memorySpacesAfter,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
