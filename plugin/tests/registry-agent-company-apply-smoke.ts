import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { RegistryLoader } from "../registries/registry-loader";
import {
  applySelectedRegistryBundleSnapshot,
  loadRegistryBundleSnapshot,
  saveRegistryBundleSnapshot,
} from "../registries/registry-snapshot";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const COMPANIES_PATH = "/root/.openclaw/workspace/agents/registry/companies.json";
const AGENTS_BACKUP = "/root/.openclaw/workspace/plugin/tests/fixtures/agents.agent-company-apply.backup.json";
const COMPANIES_BACKUP = "/root/.openclaw/workspace/plugin/tests/fixtures/companies.agent-company-apply.backup.json";
const SNAPSHOT_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/registry-agent-company.apply.snapshot.json";

async function main() {
  await copyFile(AGENTS_PATH, AGENTS_BACKUP);
  await copyFile(COMPANIES_PATH, COMPANIES_BACKUP);

  try {
    const loader = new RegistryLoader();
    const bundle = await loader.loadAll();
    await saveRegistryBundleSnapshot(SNAPSHOT_PATH, bundle);

    const rawSnapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
    rawSnapshot.bundle.agents[0].status = "paused";
    rawSnapshot.bundle.companies[0].status = "maintenance";
    await writeFile(SNAPSHOT_PATH, JSON.stringify(rawSnapshot, null, 2) + "\n", "utf8");

    const snapshot = await loadRegistryBundleSnapshot(SNAPSHOT_PATH);
    const applyResult = await applySelectedRegistryBundleSnapshot(snapshot, ["agents", "companies"]);

    const agents = JSON.parse(await readFile(AGENTS_PATH, "utf8"));
    const companies = JSON.parse(await readFile(COMPANIES_PATH, "utf8"));

    console.log(JSON.stringify({
      applyResult,
      firstAgentStatus: agents[0]?.status ?? null,
      firstCompanyStatus: companies[0]?.status ?? null,
    }, null, 2));
  } finally {
    await writeFile(AGENTS_PATH, await readFile(AGENTS_BACKUP, "utf8"), "utf8");
    await writeFile(COMPANIES_PATH, await readFile(COMPANIES_BACKUP, "utf8"), "utf8");
    await rm(SNAPSHOT_PATH, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
