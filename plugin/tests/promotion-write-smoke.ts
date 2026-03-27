import { DefaultPromotionManager } from "../operations/promotion-manager";
import type { MemoryRecordV2 } from "../types/memory";

class FakeBackendWriter {
  public writes: MemoryRecordV2[] = [];

  async write(record: MemoryRecordV2): Promise<{ memoryId: string }> {
    this.writes.push(record);
    return { memoryId: record.memoryId };
  }
}

async function main() {
  const backend = new FakeBackendWriter();
  const manager = new DefaultPromotionManager(backend);

  const result = await manager.propose({
    sourceMemoryId: "project_supermemory_fork",
    sourceScope: "project",
    destinationScope: "company",
    destinationContainer: "company_web",
    canonicalKey: "Deployment Timeout Runbook",
    content: "Reusable deployment timeout mitigation runbook.",
    summary: "Deployment timeout runbook.",
    confidence: 0.84,
    reason: "Observed repeatedly and useful across web projects",
    requestedBy: "agent_orchestrator",
    approvedBy: "agent_orchestrator",
    status: "approved",
    derivedFrom: ["project_supermemory_fork"],
    timestamp: new Date().toISOString(),
  });

  console.log(JSON.stringify({
    result,
    writes: backend.writes.map((w) => ({
      memoryId: w.memoryId,
      canonicalKey: w.canonicalKey,
      memoryScope: w.memoryScope,
      companyId: w.companyId,
      dedupKey: w.dedupKey,
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
