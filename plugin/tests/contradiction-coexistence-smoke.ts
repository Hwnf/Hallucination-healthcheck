import { DefaultContradictionPolicy } from "../policy/contradiction-policy";
import type { MemoryRecordV2 } from "../types/memory";

async function main() {
  const policy = new DefaultContradictionPolicy();

  const companyRule: MemoryRecordV2 = {
    schemaVersion: "2.0",
    memoryId: "mem_company",
    canonicalKey: "react:deployment:pattern-x",
    memoryScope: "company",
    visibility: "shared",
    status: "active",
    verificationState: "verified",
    confidence: 0.9,
    timestamp: "2026-03-20T00:00:00Z",
    content: "Use company standard pattern X",
    summary: "Company standard",
  };

  const projectOverride: MemoryRecordV2 = {
    schemaVersion: "2.0",
    memoryId: "mem_project",
    canonicalKey: "react:deployment:pattern-x",
    memoryScope: "project",
    visibility: "shared",
    status: "active",
    verificationState: "verified",
    confidence: 0.9,
    timestamp: "2026-03-25T00:00:00Z",
    content: "For this project only, use fallback pattern Y",
    summary: "Project-specific override",
  };

  const likely = policy.isLikelyContradiction(companyRule, projectOverride);
  const coexist = policy.shouldCoexist(companyRule, projectOverride);
  const record = await policy.record(companyRule, projectOverride);
  const suppressCompany = policy.shouldSuppress(companyRule, [{
    contradiction_set_id: record.contradictionSetId,
    memory_ids: record.memoryIds,
    resolution_state: record.resolutionState,
    winner_memory_id: record.winnerMemoryId,
  }]);
  const suppressProject = policy.shouldSuppress(projectOverride, [{
    contradiction_set_id: record.contradictionSetId,
    memory_ids: record.memoryIds,
    resolution_state: record.resolutionState,
    winner_memory_id: record.winnerMemoryId,
  }]);

  console.log(JSON.stringify({ likely, coexist, record, suppressCompany, suppressProject }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
