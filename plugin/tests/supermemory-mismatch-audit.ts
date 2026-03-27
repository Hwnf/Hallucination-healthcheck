import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

type AuditResult = {
  check: string;
  expected: string;
  observed: string;
  status: "match" | "partial" | "mismatch";
  note?: string;
};

async function main() {
  const client = new DefaultSupermemoryClient();
  const ts = new Date().toISOString();
  const nonce = `audit_${Date.now()}`;
  const canonicalKey = `mismatch:${nonce}`;

  const writePayload = {
    schemaVersion: "2.0" as const,
    memoryId: `mem_${nonce}`,
    canonicalKey,
    memoryType: "fact" as const,
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    companyId: "company_web",
    projectId: "project_supermemory_fork",
    userId: "436403292009005066",
    conversationId: `conv_${nonce}`,
    memoryScope: "project" as const,
    visibility: "shared" as const,
    sensitivity: "internal" as const,
    writtenBy: "agent_orchestrator",
    approvedBy: "agent_orchestrator",
    promotedFrom: null,
    promotionState: "none" as const,
    promotionReason: null,
    status: "active" as const,
    verificationState: "verified" as const,
    confidence: 0.95,
    importance: "high",
    retention: "project_lifecycle" as const,
    sourceType: "audit_test",
    sourceRef: null,
    derivedFrom: ["plugin/tests/supermemory-mismatch-audit.ts"],
    contradictionSet: null,
    supersedes: ["mem_old_audit"],
    supersededBy: null,
    effectiveFrom: ts,
    effectiveUntil: null,
    ttl: "7d",
    expiresAt: null,
    lastValidatedAt: ts,
    retrievalPriority: 0.92,
    qualityScore: 0.89,
    dedupKey: canonicalKey,
    tags: ["audit", "roundtrip"],
    timestamp: ts,
    content: `Mismatch audit content ${canonicalKey}`,
    summary: `Mismatch audit summary ${canonicalKey}`,
  };

  await client.write(writePayload);

  const results = await client.search({
    context: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      userId: "436403292009005066",
      conversationId: `conv_${nonce}`,
      companyId: "company_web",
      projectId: "project_supermemory_fork",
      provider: "discord",
      channel: "discord",
      surface: "discord",
      nowIso: ts,
      roles: [],
      capabilities: [],
    },
    intent: "active_project",
    query: canonicalKey,
    scopes: ["project"],
    includeArchived: false,
    includeSuperseded: false,
    limit: 10,
  });

  const match = results.find((r) => r.record.canonicalKey === canonicalKey || r.record.dedupKey === canonicalKey) ?? results[0];
  const rec = match?.record;

  const audit: AuditResult[] = [];
  const checks: Array<[string, any, any, string?]> = [
    ["canonicalKey", writePayload.canonicalKey, rec?.canonicalKey, "Key field for durable identity"],
    ["memoryScope", writePayload.memoryScope, rec?.memoryScope, "Scope routing and filtering depend on this"],
    ["visibility", writePayload.visibility, rec?.visibility, "ACL interpretation depends on this"],
    ["companyId", writePayload.companyId, rec?.companyId, "Company scoping depends on this"],
    ["projectId", writePayload.projectId, rec?.projectId, "Project scoping depends on this"],
    ["userId", writePayload.userId, rec?.userId, "User memory separation depends on this"],
    ["conversationId", writePayload.conversationId, rec?.conversationId, "Session correlation depends on this"],
    ["status", writePayload.status, rec?.status, "Lifecycle/retrieval suppression depends on this"],
    ["dedupKey", writePayload.dedupKey, rec?.dedupKey, "Dedup logic depends on this"],
    ["supersedes", JSON.stringify(writePayload.supersedes), JSON.stringify(rec?.supersedes), "Contradiction/supersession lineage"],
    ["retrievalPriority", String(writePayload.retrievalPriority), String(rec?.retrievalPriority), "Optional ranking hint"],
    ["qualityScore", String(writePayload.qualityScore), String(rec?.qualityScore), "Optional quality hint"],
    ["tags", JSON.stringify(writePayload.tags), JSON.stringify(rec?.tags), "Tag preservation"],
  ];

  for (const [check, expected, observed, note] of checks) {
    const exp = expected == null ? "null" : String(expected);
    const obs = observed == null ? "null" : String(observed);
    audit.push({
      check,
      expected: exp,
      observed: obs,
      status: exp === obs ? "match" : obs === "null" ? "mismatch" : "partial",
      note,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    canonicalKey,
    found: !!rec,
    audit,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
