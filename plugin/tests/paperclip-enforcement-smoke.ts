import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultAclEngine } from "../policy/acl-engine";
import { DefaultScopeRouter } from "../policy/scope-router";
import { DefaultRetrievalGate } from "../policy/retrieval-gate";
import { PreTurnHook } from "../runtime/hook-pre-turn";
import { DefaultMetadataBuilder } from "../operations/metadata-builder";
import { PostTurnHook } from "../runtime/hook-post-turn";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
import { DefaultPaperclipAdapter } from "../integrations/paperclip-adapter";
import type { PaperclipClient } from "../integrations/paperclip-client";

class FailingClient implements PaperclipClient {
  async resolveState(): Promise<any> {
    throw new Error("simulated paperclip api failure");
  }
}

class FakeSupermemoryClient extends DefaultSupermemoryClient {
  constructor() {
    // @ts-ignore
    super({ apiKey: "fake-key", baseUrl: "https://api.supermemory.ai" });
  }

  async search() {
    return [] as any;
  }

  async write(record: any) {
    return { memoryId: record.memoryId };
  }
}

async function main() {
  const apiOnlyPaperclip = new DefaultPaperclipAdapter({
    client: new FailingClient(),
    mode: "api",
    sourceOfTruth: "api-only",
    fallbackToRegistryOnError: false,
  });

  const pre = new PreTurnHook(
    new DefaultContextResolver(),
    new DefaultScopeRouter(),
    new DefaultRetrievalGate(),
    new FakeSupermemoryClient(),
    new DefaultAclEngine(),
    new DefaultAuditLogger(),
    undefined as any,
    undefined,
    apiOnlyPaperclip,
  );

  const preResult = await pre.run({
    runtimeInput: {
      agentId: "agent_orchestrator",
      agentName: "Orchestrator",
      agentKind: "orchestrator",
      provider: "discord",
      channel: "discord",
      conversationId: "conv_paperclip_enforcement_pre",
    },
    query: "api only preturn",
    intent: "active_project",
  });

  const post = new PostTurnHook(
    new DefaultContextResolver(),
    new DefaultMetadataBuilder(),
    new FakeSupermemoryClient(),
    new DefaultAclEngine(),
    undefined,
    new DefaultAuditLogger(),
    undefined,
    apiOnlyPaperclip,
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
      lifecycleState: "active",
    },
    candidate: {
      targetScope: "governance",
      targetContainer: "gov_global",
      content: "api only postturn",
      summary: "api only postturn",
      confidence: 0.9,
    },
  });

  console.log(JSON.stringify({ preResult, postResult }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
