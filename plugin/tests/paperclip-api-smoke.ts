import { ApiPaperclipClient } from "../integrations/paperclip-client";
import { DefaultContextResolver } from "../runtime/context-resolver";

async function main() {
  const resolver = new DefaultContextResolver();
  const context = await resolver.resolve({
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    companyId: "company_web",
    projectId: "project_supermemory_fork",
    provider: "discord",
    channel: "discord",
    conversationId: "conv_paperclip_api",
  });

  const calls: any[] = [];
  const client = new ApiPaperclipClient({
    baseUrl: "https://paperclip.example",
    apiKey: "test-key",
    fetchImpl: (async (url: string, init?: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return {
            state: {
              agent: {
                agent_id: "agent_orchestrator",
                roles: ["orchestrator"],
                capabilities: ["routing", "memory-governance"],
              },
              project: {
                project_id: "project_supermemory_fork",
                lifecycle_state: "active",
              },
              company: {
                company_id: "company_web",
              },
            },
          };
        },
        async text() {
          return "";
        },
      } as any;
    }) as any,
  });

  const state = await client.resolveState(context);

  console.log(JSON.stringify({
    callCount: calls.length,
    firstCall: calls[0],
    state,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
