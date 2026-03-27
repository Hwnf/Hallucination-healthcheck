import { rm } from "node:fs/promises";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { RegistryLoader } from "../registries/registry-loader";
import { RegistryApplyReportReader } from "../registries/registry-apply-report";
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

  try {
    await applySelectedRegistryBundleSnapshot(snapshot, ["memorySpaces"], undefined, loader, audit);
  } catch {}

  const reader = new RegistryApplyReportReader(audit);
  const latest = await reader.latest();
  const recent = await reader.listRecent(5);

  console.log(JSON.stringify({
    latest,
    recentCount: recent.length,
    recentStatuses: recent.map((entry) => entry.status),
    recentAttemptIds: recent.map((entry) => entry.applyAttemptId),
    latestDurationMs: latest?.durationMs ?? null,
    latestEventActions: latest?.eventActions ?? [],
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
