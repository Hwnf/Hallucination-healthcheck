import { DefaultWriteGate } from "../policy/write-gate";

async function main() {
  const gate = new DefaultWriteGate();
  const context = {
    agentId: "agent_builder",
    agentName: "Builder",
    agentKind: "agent",
    userId: "123",
    conversationId: "conv_lifecycle_gate",
    companyId: "company_web",
    projectId: "project_supermemory_fork",
    provider: "discord",
    channel: "discord",
    lifecycleState: "active",
    roles: [],
    capabilities: [],
    nowIso: new Date().toISOString(),
  };

  const archivedProjectWrite = await gate.decide(context, {
    targetScope: "project",
    targetContainer: "project_supermemory_fork",
    content: "Attempt to write into archived project memory without restore",
  });

  const restoreFlowWrite = await gate.decide(context, {
    targetScope: "project",
    targetContainer: "project_supermemory_fork",
    content: "Restore flow is rebuilding active project memory",
    metadataOverrides: {
      sourceType: "restore_flow",
      tags: ["restore", "reopen"],
    },
  });

  const archiveWrite = await gate.decide(context, {
    targetScope: "cold_storage",
    targetContainer: "archive_project_supermemory_fork",
    content: "Archive manifest update",
    metadataOverrides: {
      memoryType: "archive_manifest",
    },
  });

  console.log(JSON.stringify({ archivedProjectWrite, restoreFlowWrite, archiveWrite }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
