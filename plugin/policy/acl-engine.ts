import type { AclEngine } from "../interfaces";
import type { AclDecision, PermissionAction } from "../types/acl";
import type { ResolvedContext } from "../types/context";
import { RegistryCache } from "../registries/registry-cache";

function actionAllowed(actions: unknown, action: PermissionAction): boolean {
  return Array.isArray(actions) && actions.map(String).includes(action);
}

function requiresAudit(action: PermissionAction): boolean {
  return ["read", "write", "promote", "archive", "restore", "grant", "revoke", "delete"].includes(action);
}

function isExpired(value?: string | null): boolean {
  return !!value && new Date(value).getTime() < Date.now();
}

function scopeOfResource(bundle: any, resourceId: string): string | null {
  const space = Array.isArray(bundle.memorySpaces)
    ? bundle.memorySpaces.find((m: any) => m.memory_id === resourceId)
    : null;
  return space?.scope ?? null;
}

function normalizeRole(value: unknown): string {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "manager") return "managers";
  if (role === "operator") return "operators";
  if (role === "operative") return "operatives";
  return role;
}

function contextRoleSet(context: ResolvedContext): Set<string> {
  const set = new Set<string>();
  for (const role of context.roles ?? []) {
    const normalized = normalizeRole(role);
    if (normalized) set.add(normalized);
  }
  return set;
}

function matchesConstraints(context: ResolvedContext, constraints: any): boolean {
  if (!constraints || typeof constraints !== "object") return true;
  if (constraints.projectId && constraints.projectId !== context.projectId) return false;
  if (constraints.companyId && constraints.companyId !== context.companyId) return false;
  if (constraints.channel && constraints.channel !== context.channel) return false;
  if (constraints.provider && constraints.provider !== context.provider) return false;
  if (constraints.conversationId && constraints.conversationId !== context.conversationId) return false;

  const roleSet = contextRoleSet(context);
  const requiredRoles = Array.isArray(constraints.roles)
    ? constraints.roles.map(normalizeRole).filter(Boolean)
    : [];
  if (requiredRoles.length && !requiredRoles.some((role: string) => roleSet.has(role))) return false;

  const capabilities = new Set((context.capabilities ?? []).map((c) => String(c)));
  const requiredCapabilities = Array.isArray(constraints.capabilities)
    ? constraints.capabilities.map(String).filter(Boolean)
    : [];
  if (requiredCapabilities.length && !requiredCapabilities.every((cap: string) => capabilities.has(cap))) return false;

  return true;
}

function canMatchPrincipal(principals: unknown, context: ResolvedContext): boolean {
  if (!Array.isArray(principals)) return false;
  const roleSet = contextRoleSet(context);
  return principals.some((principal) => {
    const value = String(principal ?? "").trim();
    if (!value) return false;
    if (value === context.agentId) return true;
    return roleSet.has(normalizeRole(value));
  });
}

function inferCompanyForResource(bundle: any, resourceId: string): string | null {
  const project = Array.isArray(bundle.projects)
    ? bundle.projects.find((p: any) => p.project_id === resourceId || p.memory_id === resourceId)
    : null;
  if (project?.company_id) return project.company_id;

  const company = Array.isArray(bundle.companies)
    ? bundle.companies.find((c: any) => c.company_id === resourceId || c.memory_id === resourceId)
    : null;
  return company?.company_id ?? null;
}

function agentAssignedToCompany(bundle: any, agent: any, companyId: string | null): boolean {
  if (!companyId || !agent) return false;
  const assignedProjects = Array.isArray(agent.assigned_projects) ? agent.assigned_projects : [];
  if (!assignedProjects.length) return false;
  const projects = Array.isArray(bundle.projects) ? bundle.projects : [];
  return assignedProjects.some((projectId: string) => projects.some((p: any) => p.project_id === projectId && p.company_id === companyId));
}

function memorySpaceFallbackDecision(
  bundle: any,
  agent: any,
  context: ResolvedContext,
  action: PermissionAction,
  resourceId: string,
  registryHealthSuffix: string,
): AclDecision | null {
  const memorySpace = Array.isArray(bundle.memorySpaces)
    ? bundle.memorySpaces.find((m: any) => m.memory_id === resourceId)
    : null;
  if (!memorySpace) return null;

  if (memorySpace.owner === context.agentId) {
    return {
      allowed: true,
      action,
      resourceId,
      reason: `memory-space owner allow${registryHealthSuffix}`,
      matchedRuleId: "memory-space-owner",
      requiresAudit: requiresAudit(action),
    };
  }

  const isReadAction = action === "read";
  const isWriteAction = ["write", "update", "append"].includes(action);

  if (isReadAction && canMatchPrincipal(memorySpace.readers, context)) {
    return {
      allowed: true,
      action,
      resourceId,
      reason: `memory-space readers allow${registryHealthSuffix}`,
      matchedRuleId: "memory-space-readers",
      requiresAudit: requiresAudit(action),
    };
  }

  if (isWriteAction && canMatchPrincipal(memorySpace.writers, context)) {
    return {
      allowed: true,
      action,
      resourceId,
      reason: `memory-space writers allow${registryHealthSuffix}`,
      matchedRuleId: "memory-space-writers",
      requiresAudit: requiresAudit(action),
    };
  }

  const assignedProjects = Array.isArray(agent?.assigned_projects) ? agent.assigned_projects : [];
  if (isReadAction && memorySpace.default_read_policy === "project_assigned" && assignedProjects.includes(resourceId)) {
    return {
      allowed: true,
      action,
      resourceId,
      reason: `project-assigned read policy allow${registryHealthSuffix}`,
      matchedRuleId: "default-policy:project_assigned",
      requiresAudit: requiresAudit(action),
    };
  }

  if (isWriteAction && memorySpace.default_write_policy === "project_assigned" && assignedProjects.includes(resourceId)) {
    return {
      allowed: true,
      action,
      resourceId,
      reason: `project-assigned write policy allow${registryHealthSuffix}`,
      matchedRuleId: "default-policy:project_assigned",
      requiresAudit: requiresAudit(action),
    };
  }

  const companyId = inferCompanyForResource(bundle, resourceId);
  if (isReadAction && memorySpace.default_read_policy === "company_assigned" && agentAssignedToCompany(bundle, agent, companyId)) {
    return {
      allowed: true,
      action,
      resourceId,
      reason: `company-assigned read policy allow${registryHealthSuffix}`,
      matchedRuleId: "default-policy:company_assigned",
      requiresAudit: requiresAudit(action),
    };
  }

  const roleSet = contextRoleSet(context);
  if (isReadAction && memorySpace.default_read_policy === "designated_operative_or_orchestrator" && roleSet.has("operatives")) {
    return {
      allowed: true,
      action,
      resourceId,
      reason: `designated operative read policy allow${registryHealthSuffix}`,
      matchedRuleId: "default-policy:designated_operative_or_orchestrator",
      requiresAudit: requiresAudit(action),
    };
  }

  return null;
}

function degradedRegistriesForResource(resourceScope: string | null, action: PermissionAction): string[] {
  const registries = new Set<string>(["agents"]);
  if (["read", "write", "update", "append"].includes(action)) registries.add("memorySpaces");
  if (resourceScope === "cold_storage") registries.add("archives");
  return [...registries];
}

function shouldFailClosedForDegradedState(
  resourceScope: string | null,
  action: PermissionAction,
  degradedRegistries: string[],
): boolean {
  if (!degradedRegistries.length) return false;
  if (resourceScope && ["cold_storage", "agent_private", "user", "restricted_shared"].includes(resourceScope)) return true;
  if (["grant", "revoke", "archive", "restore", "delete"].includes(action)) return true;
  if (degradedRegistries.includes("agents") && ["read", "write", "update", "append"].includes(action)) return true;
  return false;
}

export class DefaultAclEngine implements AclEngine {
  constructor(private readonly registryCache = new RegistryCache()) {}

  async can(context: ResolvedContext, action: PermissionAction, resourceId: string): Promise<AclDecision> {
    const bundle = await this.registryCache.get();
    const health = this.registryCache.health();
    const agent = bundle.agents.find((a: any) => a.agent_id === context.agentId);
    const resourceScope = scopeOfResource(bundle, resourceId);
    const degradedRegistries = health.issues.map((i) => i.registry);
    const registryHealthSuffix = health.ok ? "" : ` (registry health degraded: ${degradedRegistries.join(", ")})`;
    const failClosed = shouldFailClosedForDegradedState(
      resourceScope,
      action,
      degradedRegistriesForResource(resourceScope, action).filter((name) => degradedRegistries.includes(name)),
    );

    if (!agent && context.agentId !== "agent_orchestrator") {
      return {
        allowed: false,
        action,
        resourceId,
        reason: `agent not present in registry${registryHealthSuffix}`,
        matchedRuleId: "registry-agent-missing",
        requiresAudit: true,
      };
    }

    const denies = Array.isArray(agent?.denies) ? agent.denies : [];
    const denyMatch = denies.find((d: any) =>
      d?.resource_id === resourceId &&
      actionAllowed(d?.actions, action) &&
      !isExpired(d?.expires_at) &&
      matchesConstraints(context, d?.constraints),
    );
    if (denyMatch) {
      return {
        allowed: false,
        action,
        resourceId,
        reason: `explicit deny on agent record${registryHealthSuffix}`,
        matchedRuleId: String(denyMatch.grant_id ?? "agent-deny"),
        requiresAudit: true,
      };
    }

    const sensitiveScopes = new Set(["restricted_shared", "agent_private", "user", "cold_storage"]);
    const explicitOnly = resourceScope ? sensitiveScopes.has(resourceScope) : false;

    if (failClosed) {
      return {
        allowed: false,
        action,
        resourceId,
        reason: `fail-closed due to degraded registry health${registryHealthSuffix}`,
        matchedRuleId: "degraded-fail-closed",
        requiresAudit: true,
      };
    }

    if (context.agentKind === "orchestrator" || context.agentId === "agent_orchestrator") {
      return {
        allowed: true,
        action,
        resourceId,
        reason: `orchestrator allow${registryHealthSuffix}`,
        matchedRuleId: "orchestrator-fast-path",
        requiresAudit: requiresAudit(action),
      };
    }

    const grants = Array.isArray(agent?.grants) ? agent.grants : [];
    const grantMatch = grants.find((g: any) => {
      if (g?.effect !== "allow") return false;
      if (g?.resource_id !== resourceId) return false;
      if (!actionAllowed(g?.actions, action)) return false;
      if (isExpired(g?.expires_at)) return false;
      if (!matchesConstraints(context, g?.constraints)) return false;
      return true;
    });

    if (explicitOnly && !grantMatch) {
      return {
        allowed: false,
        action,
        resourceId,
        reason: `explicit grant required for scope ${resourceScope}${registryHealthSuffix}`,
        matchedRuleId: `explicit-only:${resourceScope}`,
        requiresAudit: true,
      };
    }

    if (grantMatch) {
      return {
        allowed: true,
        action,
        resourceId,
        reason: `explicit grant on agent record${registryHealthSuffix}`,
        matchedRuleId: String(grantMatch.grant_id ?? "agent-grant"),
        requiresAudit: requiresAudit(action),
      };
    }

    const perms = agent?.memory_permissions ?? {};
    const bucket = perms[action] ?? perms[(action === "update" || action === "append") ? "write" : action];
    if (!explicitOnly && Array.isArray(bucket) && bucket.includes(resourceId)) {
      return {
        allowed: true,
        action,
        resourceId,
        reason: `memory_permissions allow${registryHealthSuffix}`,
        matchedRuleId: `memory_permissions:${action}`,
        requiresAudit: requiresAudit(action),
      };
    }

    if (!explicitOnly) {
      const fallback = memorySpaceFallbackDecision(bundle, agent, context, action, resourceId, registryHealthSuffix);
      if (fallback) return fallback;
    }

    return {
      allowed: false,
      action,
      resourceId,
      reason: `deny-by-default; no matching grant, permission, or memory-space policy${registryHealthSuffix}`,
      matchedRuleId: "default-deny",
      requiresAudit: true,
    };
  }
}
