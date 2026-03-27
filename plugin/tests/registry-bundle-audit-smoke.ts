import { rm } from "node:fs/promises";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { RegistryLoader } from "../registries/registry-loader";
import {
  applySelectedRegistryBundleSnapshot,
  exportRegistryBundleSnapshot,
} from "../registries/registry-snapshot";

async function main() {
  const audit = new DefaultAuditLogger();
  try {
    await rm(audit.path(), { force: true });
  } catch {}

  const loader = new RegistryLoader();
  const bundle = await loader.loadAll();
  const snapshot = exportRegistryBundleSnapshot(bundle);

  let error: string | null = null;
  try {
    await applySelectedRegistryBundleSnapshot(snapshot, ["memorySpaces"], undefined, loader, audit);
  } catch (err: any) {
    error = err?.message || String(err);
  }

  const events = await audit.readAll();
  const actions = events.map((event) => event.action);

  console.log(JSON.stringify({
    error,
    actions,
    lastEvent: events.at(-1) ?? null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
