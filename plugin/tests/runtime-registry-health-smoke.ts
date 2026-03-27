import { writeFile, readFile, copyFile, rm } from "node:fs/promises";
import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultAclEngine } from "../policy/acl-engine";
import { DefaultScopeRouter } from "../policy/scope-router";
import { DefaultRetrievalGate } from "../policy/retrieval-gate";
import { PreTurnHook } from "../runtime/hook-pre-turn";
import { DefaultMetadataBuilder } from "../operations/metadata-builder";
import { PostTurnHook } from "../runtime/hook-post-turn";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

const PROMOTIONS_PATH = "/root/.openclaw/workspace/agents/registry/promotions.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/promotions.runtime-health.backup.json";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  public writes: any[] = [];

  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async search() {
    return [
      {
        record: {
          schemaVersion: "2.0",
          memoryId: "mem_test_1",
          memoryScope: "project",
          visibility: "shared",
          status: "active",
          timestamp: new Date().toISOString(),
          content: "Project memory under degraded registry health",
          summary: "Project memory under degraded registry health",
        },
        finalScore: 0.9,
      },
    ] as any;
  }

  async write(record: any) {
    this.writes.push(record);
    return { memoryId: record.memoryId };
  }
}

async function main() {
  await copyFile(PROMOTIONS_PATH, BACKUP_PATH);
  const logger = new DefaultAuditLogger();
  try {
    await rm(logger.path(), { force: true });
  } catch {}

  try {
    await writeFile(PROMOTIONS_PATH, JSON.stringify({ broken: true }, null, 2) + "\n", "utf8");

    const fake = new FakeSupermemoryClient();
    const pre = new PreTurnHook(
      new DefaultContextResolver(),
      new DefaultScopeRouter(),
      new DefaultRetrievalGate(),
      fake,
      new DefaultAclEngine(),
      logger,
    );

    const preResult = await pre.run({
      runtimeInput: {
        agentId: "agent_orchestrator",
        agentName: "Orchestrator",
        agentKind: "orchestrator",
        provider: "discord",
        channel: "discord",
        projectId: "project_supermemory_fork",
        companyId: "company_web",
      },
      query: "project memory",
      intent: "active_project",
    });

    const post = new PostTurnHook(
      new DefaultContextResolver(),
      new DefaultMetadataBuilder(),
      fake,
      new DefaultAclEngine(),
      undefined,
      logger,
    );

    const postResult = await post.run({
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
        targetScope: "project",
        targetContainer: "project_supermemory_fork",
        content: "Write while registry health is degraded",
        summary: "Registry health degraded write",
      },
    });

    const audits = await logger.readAll();
    console.log(JSON.stringify({
      preResult,
      postResult,
      registryHealthWarnings: audits.filter((a) => a.action === "registry_health_warning"),
      aclReason: (await new DefaultAclEngine().can({
        agentId: "agent_unknown",
        agentName: "Unknown",
        agentKind: "agent",
        provider: "discord",
        channel: "discord",
        nowIso: new Date().toISOString(),
        roles: [],
        capabilities: [],
      }, "read", "project_supermemory_fork")).reason,
    }, null, 2));
  } finally {
    const original = await readFile(BACKUP_PATH, "utf8");
    await writeFile(PROMOTIONS_PATH, original, "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
