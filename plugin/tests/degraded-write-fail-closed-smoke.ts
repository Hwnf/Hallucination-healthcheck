import { writeFile, readFile, copyFile, rm } from "node:fs/promises";
import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultAclEngine } from "../policy/acl-engine";
import { DefaultMetadataBuilder } from "../operations/metadata-builder";
import { PostTurnHook } from "../runtime/hook-post-turn";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/agents.write-fail-closed.backup.json";

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
  await copyFile(AGENTS_PATH, BACKUP_PATH);
  const logger = new DefaultAuditLogger();
  try {
    await rm(logger.path(), { force: true });
  } catch {}

  try {
    await writeFile(AGENTS_PATH, JSON.stringify({ broken: true }, null, 2) + "\n", "utf8");

    const fake = new FakeSupermemoryClient();
    const hook = new PostTurnHook(
      new DefaultContextResolver(),
      new DefaultMetadataBuilder(),
      fake,
      new DefaultAclEngine(),
      undefined,
      logger,
    );

    const restrictedResult = await hook.run({
      runtimeInput: {
        agentId: "agent_builder",
        agentName: "Builder",
        agentKind: "agent",
        provider: "discord",
        channel: "discord",
        companyId: "company_web",
        projectId: "project_supermemory_fork",
      },
      candidate: {
        targetScope: "restricted_shared",
        targetContainer: "restricted_default",
        content: "Restricted write under degraded registry health",
        summary: "Restricted degraded write",
      },
    });

    const projectResult = await hook.run({
      runtimeInput: {
        agentId: "agent_builder",
        agentName: "Builder",
        agentKind: "agent",
        provider: "discord",
        channel: "discord",
        companyId: "company_web",
        projectId: "project_supermemory_fork",
      },
      candidate: {
        targetScope: "project",
        targetContainer: "project_supermemory_fork",
        content: "Project write under degraded registry health",
        summary: "Project degraded write",
      },
    });

    const orchestratorGovernanceResult = await hook.run({
      runtimeInput: {
        agentId: "agent_orchestrator",
        agentName: "Orchestrator",
        agentKind: "orchestrator",
        provider: "discord",
        channel: "discord",
        companyId: "company_web",
        projectId: "project_supermemory_fork",
      },
      candidate: {
        targetScope: "governance",
        targetContainer: "gov_global",
        content: "Governance write by orchestrator under degraded registry health",
        summary: "Orchestrator degraded governance write",
      },
    });

    const audits = await logger.readAll();
    console.log(JSON.stringify({
      restrictedResult,
      projectResult,
      orchestratorGovernanceResult,
      writesCount: fake.writes.length,
      failClosedAudits: audits.filter((a) => a.action === "write_fail_closed"),
      warningAudits: audits.filter((a) => a.action === "registry_health_warning"),
    }, null, 2));
  } finally {
    const original = await readFile(BACKUP_PATH, "utf8");
    await writeFile(AGENTS_PATH, original, "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
