import { DefaultPaperclipAdapter } from "../integrations/paperclip-adapter";
import { DefaultContextResolver } from "../runtime/context-resolver";
import type { PaperclipClient } from "../integrations/paperclip-client";

class FailingClient implements PaperclipClient {
  public calls = 0;
  async resolveState(): Promise<any> {
    this.calls += 1;
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
    conversationId: "conv_paperclip_fallback",
  });

  const failingClient = new FailingClient();
  const adapter = new DefaultPaperclipAdapter({
    client: failingClient,
    mode: "api",
    fallbackToRegistryOnError: true,
    cacheTtlMs: 30000,
  });

  const first = await adapter.enrichContext(context);
  const second = await adapter.enrichContext(context);

  console.log(JSON.stringify({
    failingClientCalls: failingClient.calls,
    first,
    second,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
