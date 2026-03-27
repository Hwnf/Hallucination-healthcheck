import type { HostPluginLifecycleState, HostPluginRecord } from "./host-registry";

export type HostPluginAction = "preTurn" | "postTurn" | "health";

export interface HostActionDecision {
  allowed: boolean;
  reason: string;
}

export interface HostActionPolicyOverrides {
  overrides?: Partial<Record<HostPluginLifecycleState, Partial<Record<HostPluginAction, HostActionDecision>>>>;
}

export function canRunHostAction(state: HostPluginLifecycleState, action: HostPluginAction): HostActionDecision {
  switch (state) {
    case "registered":
      return { allowed: true, reason: "plugin is registered and fully callable" };
    case "degraded":
      if (action === "postTurn") {
        return { allowed: false, reason: "postTurn blocked while plugin is degraded" };
      }
      return { allowed: true, reason: "degraded plugin allows read/health style actions" };
    case "rejected":
      return action === "health"
        ? { allowed: true, reason: "health allowed for rejected plugin" }
        : { allowed: false, reason: "plugin rejected by host policy" };
    case "disabled":
      return action === "health"
        ? { allowed: true, reason: "health allowed while plugin is disabled" }
        : { allowed: false, reason: "plugin disabled by host" };
    case "discovered":
    default:
      return action === "health"
        ? { allowed: true, reason: "health allowed for discovered plugin" }
        : { allowed: false, reason: "plugin not yet registered for execution" };
  }
}

export function resolveHostActionDecision(
  state: HostPluginLifecycleState,
  action: HostPluginAction,
  options: HostActionPolicyOverrides = {},
): HostActionDecision {
  const override = options.overrides?.[state]?.[action];
  return override ?? canRunHostAction(state, action);
}

export function canRunHostActionForRecord(
  record: HostPluginRecord,
  action: HostPluginAction,
  options: HostActionPolicyOverrides = {},
): HostActionDecision {
  return resolveHostActionDecision(record.state, action, options);
}
