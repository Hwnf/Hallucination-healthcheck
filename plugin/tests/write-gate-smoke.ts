import { DefaultContextResolver } from "../runtime/context-resolver";
import { DefaultWriteGate } from "../policy/write-gate";

async function main() {
  const resolver = new DefaultContextResolver();
  const gate = new DefaultWriteGate();

  const context = await resolver.resolve({
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    userId: "123",
    provider: "discord",
    channel: "discord",
    conversationId: "conv_write_gate",
  });

  const allowed = await gate.decide(context, {
    targetScope: "project",
    targetContainer: "project_supermemory_fork",
    content: "Decision: keep archived memory out of default retrieval.",
    summary: "Keep archived memory out of default retrieval.",
  });

  const blockedTranscript = await gate.decide(context, {
    targetScope: "project",
    targetContainer: "project_supermemory_fork",
    content: "<<< RAW TRANSCRIPT >>> tool output dump >>>",
  });

  const blockedPrivate = await gate.decide(context, {
    targetScope: "agent_private",
    targetContainer: "agent_someone_else_private",
    content: "Private heuristic",
  });

  console.log(JSON.stringify({ allowed, blockedTranscript, blockedPrivate }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
