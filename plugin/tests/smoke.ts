import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultAclEngine } from "../policy/acl-engine";
import { DefaultScopeRouter } from "../policy/scope-router";
import { DefaultRetrievalGate } from "../policy/retrieval-gate";
import { DefaultMetadataBuilder } from "../operations/metadata-builder";
import { scopeToResourceId } from "../utils/ids";

async function main() {
  const resolver = new DefaultContextResolver();
  const acl = new DefaultAclEngine();
  const router = new DefaultScopeRouter();
  const gate = new DefaultRetrievalGate();
  const metadata = new DefaultMetadataBuilder();

  const context = await resolver.resolve({
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    companyId: "company_web",
    projectId: "project_supermemory_fork",
    userId: "123",
    conversationId: "conv_123",
    provider: "discord",
    channel: "discord",
  });

  const route = await router.route(context, "active_project");
  const decision = await acl.can(context, "read", scopeToResourceId(context, "project"));
  const built = await metadata.build(
    {
      targetScope: "project",
      targetContainer: "project_supermemory_fork",
      content: "Project decision: keep archived memory out of default retrieval.",
      summary: "Keep archived memory out of default retrieval.",
      confidence: 0.9,
      tags: ["policy", "retrieval"],
    },
    context,
  );

  const filtered = await gate.filter(
    {
      context,
      intent: "active_project",
      query: "retrieval policy",
      scopes: route.orderedScopes,
      includeArchived: false,
      includeSuperseded: false,
      limit: 5,
    },
    [{ record: built, finalScore: 0.9 }],
  );

  console.log(JSON.stringify({
    ok: true,
    route: route.orderedScopes,
    aclAllowed: decision.allowed,
    builtMemoryId: built.memoryId,
    selectedCount: filtered.selected.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
