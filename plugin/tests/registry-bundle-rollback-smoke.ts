import { readFile } from "node:fs/promises";
import { RegistryLoader } from "../registries/registry-loader";
import {
  applySelectedRegistryBundleSnapshot,
  exportRegistryBundleSnapshot,
  planSelectedRegistryBundleApply,
} from "../registries/registry-snapshot";
import { RegistryWriter } from "../registries/registry-writer";

class FailingWriter extends RegistryWriter {
  async writeCompanies(items: unknown[]): Promise<void> {
    return super.writeCompanies(items);
  }

  async writeAgents(_items: unknown[]): Promise<void> {
    throw new Error("simulated agent apply failure");
  }
}

async function main() {
  const companiesPath = "/root/.openclaw/workspace/agents/registry/companies.json";
  const agentsPath = "/root/.openclaw/workspace/agents/registry/agents.json";
  const companiesBefore = await readFile(companiesPath, "utf8");
  const agentsBefore = await readFile(agentsPath, "utf8");
  const companiesBeforeJson = JSON.parse(companiesBefore);
  const agentsBeforeJson = JSON.parse(agentsBefore);

  const loader = new RegistryLoader();
  const bundle = await loader.loadAll();
  const snapshot = exportRegistryBundleSnapshot({
    ...bundle,
    companies: bundle.companies.map((item, index) => index === 0 ? { ...item, status: "maintenance" } : item),
    agents: bundle.agents.map((item, index) => index === 0 ? { ...item, status: "paused" } : item),
  });

  const plan = planSelectedRegistryBundleApply(["agents", "companies"]);

  let error: string | null = null;
  try {
    await applySelectedRegistryBundleSnapshot(snapshot, ["agents", "companies"], new FailingWriter(), loader);
  } catch (err: any) {
    error = err?.message || String(err);
  }

  const companiesAfter = await readFile(companiesPath, "utf8");
  const agentsAfter = await readFile(agentsPath, "utf8");
  const companiesAfterJson = JSON.parse(companiesAfter);
  const agentsAfterJson = JSON.parse(agentsAfter);

  console.log(JSON.stringify({
    plan,
    error,
    companiesRestored: JSON.stringify(companiesBeforeJson) === JSON.stringify(companiesAfterJson),
    agentsRestored: JSON.stringify(agentsBeforeJson) === JSON.stringify(agentsAfterJson),
    firstCompanyStatusAfter: companiesAfterJson[0]?.status ?? null,
    firstAgentStatusAfter: agentsAfterJson[0]?.status ?? null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
