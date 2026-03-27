import { DefaultPaperclipAdapter } from "../integrations/paperclip-adapter";
import { DefaultContextResolver } from "../runtime/context-resolver";
import type { PaperclipClient } from "../integrations/paperclip-client";

class FailingClient implements PaperclipClient {
  async resolveState(): Promise<any> {
    throw new Error("simulated paperclip api failure");
  }
}

async function main() {
  const resolver = new DefaultContextResolver();
  const context = await resolver.resolve({
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    provider: "discord",
    channel: "discord",
    conversationId: "conv_paperclip_provenance",
  });

  const adapter = new DefaultPaperclipAdapter({
    client: new FailingClient(),
    mode: "api",
    fallbackToRegistryOnError: true,
    cacheTtlMs: 30000,
  });

  const first = await adapter.enrichContext(context);
  const firstStatus = adapter.status();
  const second = await adapter.enrichContext(context);
  const secondStatus = adapter.status();

  console.log(JSON.stringify({
    first: {
      paperclipSource: first.paperclipSource,
      paperclipDegraded: first.paperclipDegraded,
      paperclipError: first.paperclipError,
    },
    firstStatus,
    second: {
      paperclipSource: second.paperclipSource,
      paperclipDegraded: second.paperclipDegraded,
      paperclipError: second.paperclipError,
    },
    secondStatus,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
