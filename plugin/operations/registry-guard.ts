import { RegistryCache } from "../registries/registry-cache";

export interface RegistryGuardDecision {
  allowed: boolean;
  degradedRegistries: string[];
  reason: string | null;
}

function intersects(left: string[], right: string[]): boolean {
  return left.some((item) => right.includes(item));
}

export async function guardRegistryMutation(requiredRegistries: string[], actionLabel: string): Promise<RegistryGuardDecision> {
  const cache = new RegistryCache();
  await cache.get();
  const health = cache.health();
  const degradedRegistries = health.issues.map((issue) => issue.registry);
  const relevant = requiredRegistries.filter((name) => degradedRegistries.includes(name));

  if (intersects(requiredRegistries, degradedRegistries)) {
    return {
      allowed: false,
      degradedRegistries: relevant,
      reason: `${actionLabel} blocked due to degraded registry health (${relevant.join(", ")})`,
    };
  }

  return {
    allowed: true,
    degradedRegistries: [],
    reason: null,
  };
}
