import { DefaultContradictionPolicy } from "../policy/contradiction-policy";
import type { MemoryRecordV2 } from "../types/memory";

async function main() {
  const policy = new DefaultContradictionPolicy();

  const left: MemoryRecordV2 = {
    schemaVersion: "2.0",
    memoryId: "mem_review_left",
    canonicalKey: "policy:runtime:conflict-a",
    memoryScope: "company",
    visibility: "shared",
    status: "active",
    verificationState: "provisional",
    confidence: 0.5,
    timestamp: "2026-03-20T00:00:00Z",
    content: "Use policy variant A",
    summary: "variant A",
  };

  const right: MemoryRecordV2 = {
    schemaVersion: "2.0",
    memoryId: "mem_review_right",
    canonicalKey: "policy:runtime:conflict-a",
    memoryScope: "company",
    visibility: "shared",
    status: "active",
    verificationState: "verified",
    confidence: 0.8,
    timestamp: "2026-03-25T00:00:00Z",
    content: "Use policy variant B",
    summary: "variant B",
  };

  const queued = await policy.queueForReview(left, right, "agent_reviewer", "needs human review");
  const suppressQueuedLeft = policy.shouldSuppress(left, [{
    contradiction_set_id: queued.contradictionSetId,
    memory_ids: queued.memoryIds,
    resolution_state: queued.resolutionState,
    winner_memory_id: queued.winnerMemoryId,
  }]);
  const resolved = await policy.resolveQueued(queued.contradictionSetId, right.memoryId, "agent_reviewer", "review completed");
  const suppressResolvedLeft = policy.shouldSuppress(left, [{
    contradiction_set_id: resolved?.contradictionSetId,
    memory_ids: resolved?.memoryIds,
    resolution_state: resolved?.resolutionState,
    winner_memory_id: resolved?.winnerMemoryId,
  }]);
  const suppressResolvedRight = policy.shouldSuppress(right, [{
    contradiction_set_id: resolved?.contradictionSetId,
    memory_ids: resolved?.memoryIds,
    resolution_state: resolved?.resolutionState,
    winner_memory_id: resolved?.winnerMemoryId,
  }]);

  console.log(JSON.stringify({
    queued,
    suppressQueuedLeft,
    resolved,
    suppressResolvedLeft,
    suppressResolvedRight,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
