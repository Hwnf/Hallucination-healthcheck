import { ApiPaperclipClient, RegistryPaperclipClient } from "../integrations/paperclip-client";
import { DefaultPaperclipAdapter } from "../integrations/paperclip-adapter";
import { DefaultContextResolver } from "../runtime/context-resolver";

async function main() {
  const resolver = new DefaultContextResolver();
  const context = await resolver.resolve({
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    provider: "discord",
    channel: "discord",
    conversationId: "conv_paperclip_client",
  });

  const registryClient = new RegistryPaperclipClient();
  const registryState = await registryClient.resolveState(context);

  const registryAdapter = new DefaultPaperclipAdapter({ mode: "registry" });
  const enriched = await registryAdapter.enrichContext(context);

  let apiError: string | null = null;
  try {
    const apiClient = new ApiPaperclipClient({
      baseUrl: "http://paperclip.local",
      fetchImpl: (async () => ({
        ok: false,
        status: 501,
        statusText: "Not Implemented",
        async json() { return {}; },
        async text() { return "not implemented"; },
      })) as any,
    });
    await apiClient.resolveState(context);
  } catch (err: any) {
    apiError = err?.message || String(err);
  }

  console.log(JSON.stringify({
    registryState: {
      hasAgent: !!registryState.agent,
      hasProject: !!registryState.project,
      hasCompany: !!registryState.company,
    },
    enriched,
    apiError,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
