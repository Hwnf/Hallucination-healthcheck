import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultMetadataBuilder } from "../operations/metadata-builder";

async function main() {
  const resolver = new DefaultContextResolver();
  const builder = new DefaultMetadataBuilder();

  const context = await resolver.resolve({
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    companyId: "company_web",
    projectId: "project_supermemory_fork",
    userId: "123",
    conversationId: "conv_meta",
    provider: "discord",
    channel: "discord",
    lifecycleState: "archived",
  });

  const governance = await builder.build({
    targetScope: "governance",
    targetContainer: "gov_global",
    content: "Governance rule.",
    summary: "Governance rule.",
    confidence: 0.9,
  }, context);

  const privateMem = await builder.build({
    targetScope: "agent_private",
    targetContainer: "agent_agent_orchestrator_private",
    content: "Private note.",
    summary: "Private note.",
  }, context);

  const archiveMem = await builder.build({
    targetScope: "cold_storage",
    targetContainer: "archive_project_supermemory_fork",
    content: "Archive note.",
    summary: "Archive note.",
    metadataOverrides: { memoryType: "archive_manifest" },
  }, context);

  console.log(JSON.stringify({
    governance: {
      visibility: governance.visibility,
      sensitivity: governance.sensitivity,
      retention: governance.retention,
      sourceType: governance.sourceType,
      status: governance.status,
      retrievalPriority: governance.retrievalPriority,
    },
    privateMem: {
      visibility: privateMem.visibility,
      sensitivity: privateMem.sensitivity,
      retention: privateMem.retention,
    },
    archiveMem: {
      visibility: archiveMem.visibility,
      sensitivity: archiveMem.sensitivity,
      retention: archiveMem.retention,
      sourceType: archiveMem.sourceType,
      status: archiveMem.status,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
