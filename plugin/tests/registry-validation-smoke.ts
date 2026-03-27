import { RegistryWriter } from "../registries/registry-writer";

async function main() {
  const writer = new RegistryWriter();

  let promotionError: string | null = null;
  let archiveError: string | null = null;

  try {
    await writer.writePromotions([
      {
        promotion_id: "promo_test",
        from_memory_id: "project_supermemory_fork",
        from_scope: "project",
        to_scope: "company",
        // missing to_memory_id on purpose
        canonical_key: "deploy-timeout-runbook",
        requested_by: "agent_orchestrator",
        reason: "test",
        status: "approved",
        timestamp: new Date().toISOString(),
      } as any,
    ]);
  } catch (err: any) {
    promotionError = err?.message || String(err);
  }

  try {
    await writer.writeArchives([
      {
        archive_id: "archive_test",
        project_id: "project_supermemory_fork",
        archive_memory_id: "archive_project_supermemory_fork",
        status: "archived",
        archived_by: "agent_orchestrator",
        // missing archived_at on purpose
      } as any,
    ]);
  } catch (err: any) {
    archiveError = err?.message || String(err);
  }

  console.log(JSON.stringify({ promotionError, archiveError }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
