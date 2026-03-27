import { writeFile, readFile, copyFile, rm } from "node:fs/promises";
import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultAclEngine } from "../policy/acl-engine";
import { DefaultScopeRouter } from "../policy/scope-router";
import { DefaultRetrievalGate } from "../policy/retrieval-gate";
import { PreTurnHook } from "../runtime/hook-pre-turn";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/agents.fail-closed.backup.json";

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async search(request: any) {
    return (request.scopes || []).map((scope: string, index: number) => ({
      record: {
        schemaVersion: "2.0",
        memoryId: `mem_${scope}_${index}`,
        memoryScope: scope,
        visibility: "shared",
        status: scope === "cold_storage" ? "archived" : "active",
        timestamp: new Date().toISOString(),
        content: `Memory from ${scope}`,
        summary: `Memory from ${scope}`,
      },
      finalScore: 1 - index * 0.01,
    })) as any;
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

    const acl = new DefaultAclEngine();
    const coldStorageDecision = await acl.can({
      agentId: "agent_manager",
      agentName: "Manager",
      agentKind: "agent",
      provider: "discord",
      channel: "discord",
      projectId: "project_supermemory_fork",
      nowIso: new Date().toISOString(),
      roles: ["manager"],
      capabilities: [],
    }, "read", "archive_project_supermemory_fork");

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
        lifecycleState: "archived",
      },
      query: "archived precedent",
      intent: "precedent_lookup",
    });

    console.log(JSON.stringify({
      coldStorageDecision,
      result,
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
