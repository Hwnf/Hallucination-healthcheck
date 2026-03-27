import { DefaultContradictionPolicy } from "../policy/contradiction-policy";
import { ContradictionReportReader } from "../policy/contradiction-report";
import type { MemoryRecordV2 } from "../types/memory";

async function main() {
  const policy = new DefaultContradictionPolicy();
  const report = new ContradictionReportReader();

  const left: MemoryRecordV2 = {
    schemaVersion: "2.0",
    memoryId: "mem_report_left",
    canonicalKey: "policy:runtime:conflict-report",
    memoryScope: "company",
    visibility: "shared",
    status: "active",
    verificationState: "provisional",
    confidence: 0.4,
    timestamp: "2026-03-20T00:00:00Z",
    content: "Use report variant A",
    summary: "report A",
  };

  const right: MemoryRecordV2 = {
    schemaVersion: "2.0",
    memoryId: "mem_report_right",
    canonicalKey: "policy:runtime:conflict-report",
    memoryScope: "company",
    visibility: "shared",
    status: "active",
    verificationState: "verified",
    confidence: 0.9,
    timestamp: "2026-03-25T00:00:00Z",
    content: "Use report variant B",
    summary: "report B",
  };

  const queued = await policy.queueForReview(left, right, "agent_reviewer", "report queue test");
  const openBefore = await report.listOpenReview(10);
  const summaryBefore = await report.summary();

  const resolved = await policy.resolveQueued(queued.contradictionSetId, right.memoryId, "agent_reviewer", "report resolved");
  const openAfter = await report.listOpenReview(10);
  const resolvedAfter = await report.listResolved(10);
  const summaryAfter = await report.summary();

  console.log(JSON.stringify({
    queued,
    openBefore: openBefore.filter((entry) => entry.contradictionSetId === queued.contradictionSetId),
    summaryBefore,
    resolved,
    openAfter: openAfter.filter((entry) => entry.contradictionSetId === queued.contradictionSetId),
    resolvedAfter: resolvedAfter.filter((entry) => entry.contradictionSetId === queued.contradictionSetId),
    summaryAfter,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
