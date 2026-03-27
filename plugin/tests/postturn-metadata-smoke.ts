import { rm } from "node:fs/promises";
import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultAclEngine } from "../policy/acl-engine";
import { DefaultMetadataBuilder } from "../operations/metadata-builder";
import { PostTurnHook } from "../runtime/hook-post-turn";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  public writes: any[] = [];

  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async write(record: any) {
    this.writes.push(record);
    return { memoryId: record.memoryId };
  }
}

async function main() {
  const logger = new DefaultAuditLogger();
  try {
    await rm(logger.path(), { force: true });
  } catch {}

  const fake = new FakeSupermemoryClient();
  const hook = new PostTurnHook(
    new DefaultContextResolver(),
    new DefaultMetadataBuilder(),
    fake,
    new DefaultAclEngine(),
    undefined,
    logger,
  );

  const governanceResult = await hook.run({
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      companyId: "company_web",
      projectId: "project_supermemory_fork",
      lifecycleState: "active",
    },
    candidate: {
      targetScope: "governance",
      targetContainer: "gov_global",
      content: "Policy decision for orchestrator review.",
      summary: "Policy decision.",
      confidence: 0.92,
    },
  });

  const deniedArchivedProjectResult = await hook.run({
    runtimeInput: {
      agentId: "agent_builder",
      agentName: "Builder",
      agentKind: "agent",
      provider: "discord",
      channel: "discord",
      companyId: "company_web",
      projectId: "project_supermemory_fork",
      lifecycleState: "archived",
    },
    candidate: {
      targetScope: "project",
      targetContainer: "project_supermemory_fork",
      content: "Normal write into archived project should be blocked.",
      summary: "Blocked archived project write.",
      confidence: 0.5,
    },
  });

  const audits = await logger.readAll();

  console.log(JSON.stringify({
    governanceResult,
    deniedArchivedProjectResult,
    writes: fake.writes.map((w) => ({
      memoryScope: w.memoryScope,
      visibility: w.visibility,
      sensitivity: w.sensitivity,
      retention: w.retention,
      sourceType: w.sourceType,
      status: w.status,
      retrievalPriority: w.retrievalPriority,
      dedupKey: w.dedupKey,
    })),
    auditActions: audits.map((a) => a.action),
    deniedAudit: audits.find((a) => a.action === "write_gate_denied") ?? null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
