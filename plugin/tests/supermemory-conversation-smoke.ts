import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

async function main() {
  const client = new DefaultSupermemoryClient();
  const nonce = Date.now();
  const conversationId = `conv_smoke_${nonce}`;
  const marker = `conversation-smoke-${nonce}`;

  await client.ingestConversation(
    conversationId,
    [
      { role: "user", content: `User message ${marker}` },
      { role: "assistant", content: `Assistant reply ${marker}` },
    ],
    {
      projectId: "project_supermemory_fork",
      companyId: "company_web",
      marker,
    },
  );

  const searchResults = await client.search({
    context: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      userId: "436403292009005066",
      conversationId,
      companyId: "company_web",
      projectId: "project_supermemory_fork",
      provider: "discord",
      channel: "discord",
      surface: "discord",
      nowIso: new Date().toISOString(),
      roles: [],
      capabilities: [],
    },
    intent: "active_project",
    query: marker,
    scopes: ["session", "project"],
    includeArchived: false,
    includeSuperseded: false,
    limit: 10,
  });

  const top = searchResults[0]?.record ?? null;

  console.log(JSON.stringify({
    ok: true,
    conversationId,
    marker,
    searchCount: searchResults.length,
    top: top ? {
      memoryId: top.memoryId,
      canonicalKey: top.canonicalKey,
      conversationId: top.conversationId,
      projectId: top.projectId,
      companyId: top.companyId,
      memoryScope: top.memoryScope,
      contentPreview: top.content?.slice(0, 120),
    } : null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
