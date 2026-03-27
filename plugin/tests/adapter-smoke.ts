import { DefaultOpenClawAdapter } from "../integrations/openclaw-adapter";
import { DefaultPaperclipAdapter } from "../integrations/paperclip-adapter";
import { DefaultContextResolver } from "../runtime/context-resolver";

async function main() {
  const openclaw = new DefaultOpenClawAdapter();
  const paperclip = new DefaultPaperclipAdapter();
  const resolver = new DefaultContextResolver();

  const normalized = openclaw.normalizeInput({
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    provider: "discord",
    channel: "discord",
    conversationId: "conv_adapter",
  });

  const base = await resolver.resolve(normalized);
  const enriched = await paperclip.enrichContext(base);

  console.log(JSON.stringify({ normalized, base, enriched }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
