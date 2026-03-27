import { DefaultScopeRouter } from "../policy/scope-router";
import { scopeToResourceId } from "../utils/ids";
import { DefaultContextResolver } from "../runtime/context-resolver";

async function main() {
  const resolver = new DefaultContextResolver();
  const router = new DefaultScopeRouter();

  const archivedContext = await resolver.resolve({
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    companyId: "company_web",
    projectId: "project_supermemory_fork",
    provider: "discord",
    channel: "discord",
    lifecycleState: "archived",
  });

  const activeContext = await resolver.resolve({
    agentId: "agent_orchestrator",
    agentName: "Orchestrator",
    agentKind: "orchestrator",
    companyId: "company_web",
    projectId: "project_supermemory_fork",
    provider: "discord",
    channel: "discord",
    lifecycleState: "active",
  });

  const archivedActiveProjectRoute = await router.route(archivedContext, "active_project");
  const archivedPrecedentRoute = await router.route(archivedContext, "precedent_lookup");
  const activeProjectRoute = await router.route(activeContext, "active_project");

  console.log(JSON.stringify({
    archivedActiveProjectRoute,
    archivedPrecedentRoute,
    activeProjectRoute,
    archivedColdStorageResourceId: scopeToResourceId(archivedContext, "cold_storage"),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
