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
    conversationId: "conv_paperclip_source_policy",
  });

  const preferred = new DefaultPaperclipAdapter({
    client: new FailingClient(),
    mode: "api",
    sourceOfTruth: "api-preferred",
    fallbackToRegistryOnError: true,
  });
  const preferredResult = await preferred.enrichContext(context);
  const preferredStatus = preferred.status();

  let apiOnlyError: string | null = null;
  try {
    const apiOnly = new DefaultPaperclipAdapter({
      client: new FailingClient(),
      mode: "api",
      sourceOfTruth: "api-only",
      fallbackToRegistryOnError: false,
    });
    await apiOnly.enrichContext(context);
  } catch (err: any) {
    apiOnlyError = err?.message || String(err);
  }

  console.log(JSON.stringify({
    preferredResult: {
      paperclipSource: preferredResult.paperclipSource,
      paperclipDegraded: preferredResult.paperclipDegraded,
      paperclipError: preferredResult.paperclipError,
    },
    preferredStatus,
    apiOnlyError,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
