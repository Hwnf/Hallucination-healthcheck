import { rm } from "node:fs/promises";
import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultAclEngine } from "../policy/acl-engine";
import { DefaultScopeRouter } from "../policy/scope-router";
import { DefaultRetrievalGate } from "../policy/retrieval-gate";
import { PreTurnHook } from "../runtime/hook-pre-turn";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async search() {
    return [
      {
        record: {
          schemaVersion: "2.0",
          memoryId: "mem_archive_1",
          memoryScope: "cold_storage",
          visibility: "manager_operator_only",
          status: "archived",
          timestamp: new Date().toISOString(),
          content: "Archived precedent for project_supermemory_fork",
          summary: "Archived precedent for project_supermemory_fork",
        },
        finalScore: 0.95,
      },
    ] as any;
  }
}

async function main() {
  const logger = new DefaultAuditLogger();
  try {
    await rm(logger.path(), { force: true });
  } catch {}

  const hook = new PreTurnHook(
    new DefaultContextResolver(),
    new DefaultScopeRouter(),
    new DefaultRetrievalGate(),
    new FakeSupermemoryClient(),
    new DefaultAclEngine(),
    logger,
  );

  const result = await hook.run({
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      projectId: "project_supermemory_fork",
      companyId: "company_web",
      conversationId: "conv_sensitive_retrieval",
      lifecycleState: "archived",
    },
    query: "archived precedent",
    intent: "precedent_lookup",
  });

  const audits = await logger.readAll();
  const sensitiveAudits = audits.filter((item) => item.action === "retrieval_sensitive");

  console.log(JSON.stringify({
    result,
    sensitiveAuditCount: sensitiveAudits.length,
    sensitiveAudit: sensitiveAudits[0] ?? null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
