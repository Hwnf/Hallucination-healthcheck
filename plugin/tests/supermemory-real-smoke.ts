import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

async function main() {
  const client = new DefaultSupermemoryClient();
  const timestamp = new Date().toISOString();
  const projectId = "project_supermemory_fork";
  const canonicalKey = `smoke:${Date.now()}`;

  const writeResult = await client.write({
    schemaVersion: "2.0",
    memoryId: `mem_smoke_${Date.now()}`,
    canonicalKey,
    memoryType: "fact",
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    companyId: "company_web",
    projectId,
    userId: null,
    conversationId: "conv_supermemory_smoke",
    memoryScope: "project",
    visibility: "shared",
    sensitivity: "internal",
    writtenBy: "agent_orchestrator",
    approvedBy: "agent_orchestrator",
    promotedFrom: null,
    promotionState: "none",
    promotionReason: null,
    status: "active",
    verificationState: "verified",
    confidence: 0.99,
    importance: "high",
    retention: "project_lifecycle",
    sourceType: "smoke_test",
    sourceRef: null,
    derivedFrom: ["plugin/tests/supermemory-real-smoke.ts"],
    contradictionSet: null,
    supersedes: null,
    supersededBy: null,
    effectiveFrom: timestamp,
    effectiveUntil: null,
    ttl: null,
    expiresAt: null,
    lastValidatedAt: timestamp,
    retrievalPriority: 1,
    qualityScore: 1,
    dedupKey: canonicalKey,
    tags: ["smoke", "project", "supermemory"],
    timestamp,
    content: `Supermemory real smoke content ${canonicalKey}`,
    summary: `Supermemory real smoke ${canonicalKey}`,
  });

  const searchResults = await client.search({
    context: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      userId: null,
      conversationId: "conv_supermemory_smoke",
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
    limit: 5,
  });

  console.log(JSON.stringify({
    ok: true,
    writeMemoryId: writeResult.memoryId,
    searchCount: searchResults.length,
    top: searchResults[0]?.record
      ? {
          memoryId: searchResults[0].record.memoryId,
          canonicalKey: searchResults[0].record.canonicalKey,
          projectId: searchResults[0].record.projectId,
          memoryScope: searchResults[0].record.memoryScope,
        }
      : null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
