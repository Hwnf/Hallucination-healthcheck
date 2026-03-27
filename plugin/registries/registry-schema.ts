import type { RegistryIssue } from "./registry-health";

export interface RegistrySchemaRule {
  itemVersionKey: string;
  expectedVersion: string;
  required: boolean;
}

export const REGISTRY_SCHEMA_RULES: Record<string, RegistrySchemaRule | undefined> = {
  agents: { itemVersionKey: "schema_version", expectedVersion: "2.0", required: true },
  companies: { itemVersionKey: "schema_version", expectedVersion: "2.0", required: true },
  projects: { itemVersionKey: "schema_version", expectedVersion: "2.0", required: true },
  memorySpaces: { itemVersionKey: "schema_version", expectedVersion: "2.0", required: true },
  policies: { itemVersionKey: "schema_version", expectedVersion: "2.0", required: true },
};

export function checkRegistrySchemaCompatibility(registry: string, path: string, items: any[]): RegistryIssue[] {
  const rule = REGISTRY_SCHEMA_RULES[registry];
  if (!rule || !Array.isArray(items) || items.length === 0) return [];

  const issues: RegistryIssue[] = [];
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const actual = item[rule.itemVersionKey];

    if (actual == null) {
      if (rule.required) {
        issues.push({
          registry,
          path,
          severity: "error",
          message: `registry item ${index} missing required ${rule.itemVersionKey}; expected ${rule.expectedVersion}`,
        });
      }
      continue;
    }

    if (String(actual) !== rule.expectedVersion) {
      issues.push({
        registry,
        path,
        severity: "error",
        message: `registry item ${index} has unsupported ${rule.itemVersionKey}=${String(actual)}; expected ${rule.expectedVersion}`,
      });
    }
  }

  return issues;
}
