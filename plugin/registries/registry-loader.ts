import { readFile } from "node:fs/promises";
import type { RegistryHealth, RegistryIssue } from "./registry-health";
import { checkRegistrySchemaCompatibility } from "./registry-schema";

export interface RegistryBundle {
  agents: any[];
  companies: any[];
  projects: any[];
  memorySpaces: any[];
  promotions: any[];
  archives: any[];
  experienceIndex: any[];
  policies: any[];
  contradictions: any[];
}

const ROOT = "/root/.openclaw/workspace/agents/registry";

export interface RegistryLoadResult {
  items: any[];
  issues: RegistryIssue[];
}

async function readJsonArray(registry: string, path: string): Promise<RegistryLoadResult> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        items: [],
        issues: [{
          registry,
          path,
          severity: "error",
          message: "registry file parsed but root value was not an array",
        }],
      };
    }
    return {
      items: parsed,
      issues: checkRegistrySchemaCompatibility(registry, path, parsed),
    };
  } catch (err: any) {
    const code = err?.code;
    if (code === "ENOENT") {
      return {
        items: [],
        issues: [{
          registry,
          path,
          severity: "warning",
          message: "registry file missing; using empty array fallback",
        }],
      };
    }

    return {
      items: [],
      issues: [{
        registry,
        path,
        severity: "error",
        message: `failed to load registry file: ${err?.message || String(err)}`,
      }],
    };
  }
}

export class RegistryLoader {
  private lastHealth: RegistryHealth = {
    ok: true,
    issues: [],
    loadedAt: new Date(0).toISOString(),
  };

  health(): RegistryHealth {
    return this.lastHealth;
  }

  async loadAll(): Promise<RegistryBundle> {
    const [agents, companies, projects, memorySpaces, promotions, archives, experienceIndex, policies, contradictions] =
      await Promise.all([
        readJsonArray("agents", `${ROOT}/agents.json`),
        readJsonArray("companies", `${ROOT}/companies.json`),
        readJsonArray("projects", `${ROOT}/projects.json`),
        readJsonArray("memorySpaces", `${ROOT}/memory_spaces.json`),
        readJsonArray("promotions", `${ROOT}/promotions.json`),
        readJsonArray("archives", `${ROOT}/archives.json`),
        readJsonArray("experienceIndex", `${ROOT}/experience_index.json`),
        readJsonArray("policies", `${ROOT}/policies.json`),
        readJsonArray("contradictions", `${ROOT}/contradictions.json`),
      ]);

    const issues = [
      ...agents.issues,
      ...companies.issues,
      ...projects.issues,
      ...memorySpaces.issues,
      ...promotions.issues,
      ...archives.issues,
      ...experienceIndex.issues,
      ...policies.issues,
      ...contradictions.issues,
    ];

    this.lastHealth = {
      ok: !issues.some((issue) => issue.severity === "error"),
      issues,
      loadedAt: new Date().toISOString(),
    };

    return {
      agents: agents.items,
      companies: companies.items,
      projects: projects.items,
      memorySpaces: memorySpaces.items,
      promotions: promotions.items,
      archives: archives.items,
      experienceIndex: experienceIndex.items,
      policies: policies.items,
      contradictions: contradictions.items,
    };
  }
}
