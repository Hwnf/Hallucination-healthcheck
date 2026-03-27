import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

async function main() {
  const client = new DefaultSupermemoryClient();
  const timestamp = new Date().toISOString();
  const nonce = `rt_${Date.now()}`;
  const projectId = "project_supermemory_fork";
  const canonicalKey = `roundtrip:${nonce}`;

  const writePayload = {
    schemaVersion: "2.0" as const,
    memoryId: `mem_${nonce}`,
    canonicalKey,
    memoryType: "fact" as const,
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    companyId: "company_web",
    projectId,
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
    confidence: 0.97,
    importance: "high",
    retention: "project_lifecycle" as const,
    sourceType: "roundtrip_test",
    sourceRef: null,
    derivedFrom: ["plugin/tests/supermemory-metadata-roundtrip.ts"],
    contradictionSet: null,
    supersedes: ["mem_older_example"],
    supersededBy: null,
    effectiveFrom: timestamp,
    effectiveUntil: null,
    ttl: "7d",
    expiresAt: null,
    lastValidatedAt: timestamp,
    retrievalPriority: 0.91,
    qualityScore: 0.88,
    dedupKey: canonicalKey,
    tags: ["roundtrip", "metadata", "supermemory"],
    timestamp,
    content: `Metadata roundtrip content ${canonicalKey}`,
    summary: `Metadata roundtrip summary ${canonicalKey}`,
  };

  const writeResult = await client.write(writePayload);

  const searchResults = await client.search({
    context: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      userId: "436403292009005066",
      conversationId: `conv_${nonce}`,
      companyId: "company_web",
      projectId,
      provider: "discord",
      channel: "discord",
      surface: "discord",
      nowIso: timestamp,
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

  const match = searchResults.find((r) => r.record.canonicalKey === canonicalKey || r.record.dedupKey === canonicalKey) ?? searchResults[0];

  console.log(JSON.stringify({
    ok: true,
    writeMemoryId: writeResult.memoryId,
    searchCount: searchResults.length,
    expected: {
      canonicalKey: writePayload.canonicalKey,
      memoryScope: writePayload.memoryScope,
      visibility: writePayload.visibility,
      companyId: writePayload.companyId,
      projectId: writePayload.projectId,
      userId: writePayload.userId,
      conversationId: writePayload.conversationId,
      status: writePayload.status,
      dedupKey: writePayload.dedupKey,
      supersedes: writePayload.supersedes,
      retrievalPriority: writePayload.retrievalPriority,
      qualityScore: writePayload.qualityScore,
      tags: writePayload.tags,
    },
    actual: match ? {
      memoryId: match.record.memoryId,
      canonicalKey: match.record.canonicalKey,
      memoryScope: match.record.memoryScope,
      visibility: match.record.visibility,
      companyId: match.record.companyId,
      projectId: match.record.projectId,
      userId: match.record.userId,
      conversationId: match.record.conversationId,
      status: match.record.status,
      dedupKey: match.record.dedupKey,
      supersedes: match.record.supersedes,
      retrievalPriority: match.record.retrievalPriority,
      qualityScore: match.record.qualityScore,
      tags: match.record.tags,
      contentPreview: match.record.content?.slice(0, 120),
    } : null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
