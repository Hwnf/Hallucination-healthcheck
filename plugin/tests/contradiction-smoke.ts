import { DefaultContradictionPolicy } from "../policy/contradiction-policy";
import type { MemoryRecordV2 } from "../types/memory";

async function main() {
  const policy = new DefaultContradictionPolicy();

  const older: MemoryRecordV2 = {
    schemaVersion: "2.0",
    memoryId: "mem_old",
    canonicalKey: "react:deployment:pattern-x",
    memoryScope: "company",
    visibility: "shared",
    status: "active",
    verificationState: "provisional",
    confidence: 0.6,
    timestamp: "2026-03-20T00:00:00Z",
    content: "Use old pattern X",
    summary: "Old pattern",
  };

  const newer: MemoryRecordV2 = {
    schemaVersion: "2.0",
    memoryId: "mem_new",
    canonicalKey: "react:deployment:pattern-x",
    memoryScope: "company",
    visibility: "shared",
    status: "active",
    verificationState: "verified",
    confidence: 0.9,
    timestamp: "2026-03-25T00:00:00Z",
    content: "Use new pattern X2",
    summary: "New pattern",
  };

  const likely = policy.isLikelyContradiction(older, newer);
  const record = await policy.record(older, newer);
  const suppressOld = policy.shouldSuppress(older, [{
    contradiction_set_id: record.contradictionSetId,
    memory_ids: record.memoryIds,
    winner_memory_id: record.winnerMemoryId,
  }]);
  const suppressNew = policy.shouldSuppress(newer, [{
    contradiction_set_id: record.contradictionSetId,
    memory_ids: record.memoryIds,
    winner_memory_id: record.winnerMemoryId,
  }]);

  console.log(JSON.stringify({ likely, record, suppressOld, suppressNew }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
