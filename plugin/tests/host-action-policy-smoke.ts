import { canRunHostAction } from "../runtime/host-action-policy";

async function main() {
  const states = ["discovered", "registered", "degraded", "rejected", "disabled"] as const;
  const actions = ["preTurn", "postTurn", "health"] as const;

  const matrix = states.map((state) => ({
    state,
    actions: actions.map((action) => ({
      action,
      decision: canRunHostAction(state, action),
    })),
  }));

  console.log(JSON.stringify({ matrix }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
