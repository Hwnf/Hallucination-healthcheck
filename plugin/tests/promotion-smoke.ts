import { DefaultPromotionManager } from "../operations/promotion-manager";

async function main() {
  const manager = new DefaultPromotionManager();

  const approved = await manager.propose({
    sourceMemoryId: "project_supermemory_fork",
    sourceScope: "project",
    destinationScope: "company",
    destinationContainer: "company_web",
    canonicalKey: "Deployment Timeout Runbook",
    content: "Reusable deployment timeout mitigation runbook.",
    summary: "Deployment timeout runbook.",
    confidence: 0.84,
    reason: "Observed repeatedly and useful across web projects",
    requestedBy: "agent_orchestrator",
    approvedBy: "agent_orchestrator",
    status: "approved",
    derivedFrom: ["project_supermemory_fork"],
    timestamp: new Date().toISOString(),
  });

  const rejected = await manager.propose({
    sourceMemoryId: "project_supermemory_fork",
    sourceScope: "project",
    destinationScope: "company",
    destinationContainer: "company_web",
    canonicalKey: "",
    content: "",
    confidence: 0.2,
    reason: "bad candidate",
    requestedBy: "agent_orchestrator",
    status: "proposed",
    derivedFrom: [],
    timestamp: new Date().toISOString(),
  } as any);

  console.log(JSON.stringify({ approved, rejected }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
