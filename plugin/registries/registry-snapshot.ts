import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { writeJsonAtomic } from "./atomic-file";
import type { RegistryBundle } from "./registry-loader";
import { RegistryLoader } from "./registry-loader";
import { RegistryWriter } from "./registry-writer";
import { DefaultAuditLogger } from "../operations/audit-logger";

export interface RegistryBundleSnapshot {
  schemaVersion: "blueprint-v2-registry-bundle.v1";
  exportedAt: string;
  itemSchemaVersion: "2.0";
  bundle: RegistryBundle;
}

export type SnapshotWritableRegistry =
  | "agents"
  | "companies"
  | "projects"
  | "memorySpaces"
  | "policies"
  | "promotions"
  | "archives"
  | "experienceIndex"
  | "contradictions";

export interface RegistryApplyPlan {
  requested: SnapshotWritableRegistry[];
  ordered: SnapshotWritableRegistry[];
}

export interface RegistryApplyPreflight {
  ok: boolean;
  requested: SnapshotWritableRegistry[];
  ordered: SnapshotWritableRegistry[];
  missingDependencies: Array<{ registry: SnapshotWritableRegistry; requires: SnapshotWritableRegistry[] }>;
  warnings: string[];
}

export interface RegistryApplyResult {
  applied: SnapshotWritableRegistry[];
  ordered: SnapshotWritableRegistry[];
  rolledBack: SnapshotWritableRegistry[];
  applyAttemptId: string;
}

const REGISTRY_APPLY_ORDER: SnapshotWritableRegistry[] = [
  "companies",
  "agents",
  "projects",
  "memorySpaces",
  "policies",
  "promotions",
  "archives",
  "experienceIndex",
  "contradictions",
];

const REGISTRY_DEPENDENCIES: Partial<Record<SnapshotWritableRegistry, SnapshotWritableRegistry[]>> = {
  agents: ["companies"],
  projects: ["companies", "agents"],
  memorySpaces: ["projects"],
  promotions: ["projects", "companies"],
  archives: ["projects", "memorySpaces"],
  experienceIndex: ["agents"],
};

export function exportRegistryBundleSnapshot(bundle: RegistryBundle): RegistryBundleSnapshot {
  return {
    schemaVersion: "blueprint-v2-registry-bundle.v1",
    exportedAt: new Date().toISOString(),
    itemSchemaVersion: "2.0",
    bundle,
  };
}

export function importRegistryBundleSnapshot(snapshot: RegistryBundleSnapshot): RegistryBundle {
  if (!snapshot || snapshot.schemaVersion !== "blueprint-v2-registry-bundle.v1") {
    throw new Error(`Unsupported registry bundle snapshot schema: ${snapshot?.schemaVersion ?? "unknown"}`);
  }
  if (snapshot.itemSchemaVersion !== "2.0") {
    throw new Error(`Unsupported registry bundle item schema version: ${snapshot.itemSchemaVersion}`);
  }
  return snapshot.bundle;
}

export function planSelectedRegistryBundleApply(selected: SnapshotWritableRegistry[]): RegistryApplyPlan {
  const requested = [...new Set(selected)];
  const ordered = REGISTRY_APPLY_ORDER.filter((registry) => requested.includes(registry));
  return { requested, ordered };
}

export function preflightSelectedRegistryBundleApply(selected: SnapshotWritableRegistry[]): RegistryApplyPreflight {
  const plan = planSelectedRegistryBundleApply(selected);
  const missingDependencies: Array<{ registry: SnapshotWritableRegistry; requires: SnapshotWritableRegistry[] }> = [];
  const warnings: string[] = [];

  for (const registry of plan.requested) {
    const deps = REGISTRY_DEPENDENCIES[registry] ?? [];
    const missing = deps.filter((dep) => !plan.requested.includes(dep));
    if (missing.length) {
      missingDependencies.push({ registry, requires: missing });
    }
  }

  if (plan.requested.includes("archives") && !plan.requested.includes("promotions")) {
    warnings.push("archives apply without promotions; archive manifests may refer to promotion outputs not refreshed in this apply set");
  }

  if (plan.requested.includes("projects") && !plan.requested.includes("policies")) {
    warnings.push("projects apply without policies; lifecycle state may reference stale policy expectations");
  }

  return {
    ok: missingDependencies.length === 0,
    requested: plan.requested,
    ordered: plan.ordered,
    missingDependencies,
    warnings,
  };
}

export async function saveRegistryBundleSnapshot(path: string, bundle: RegistryBundle): Promise<RegistryBundleSnapshot> {
  const dir = path.split("/").slice(0, -1).join("/");
  if (dir) {
    await mkdir(dir, { recursive: true });
  }
  const snapshot = exportRegistryBundleSnapshot(bundle);
  await writeJsonAtomic(path, snapshot);
  return snapshot;
}

export async function loadRegistryBundleSnapshot(path: string): Promise<RegistryBundleSnapshot> {
  const raw = await readFile(path, "utf8");
  const snapshot = JSON.parse(raw) as RegistryBundleSnapshot;
  importRegistryBundleSnapshot(snapshot);
  return snapshot;
}

async function writeRegistryByName(
  writer: RegistryWriter,
  bundle: RegistryBundle,
  registry: SnapshotWritableRegistry,
): Promise<void> {
  if (registry === "promotions") return writer.writePromotions(bundle.promotions);
  if (registry === "archives") return writer.writeArchives(bundle.archives);
  if (registry === "experienceIndex") return writer.writeExperienceIndex(bundle.experienceIndex);
  if (registry === "contradictions") return writer.writeContradictions(bundle.contradictions);
  if (registry === "projects") return writer.writeProjects(bundle.projects);
  if (registry === "memorySpaces") return writer.writeMemorySpaces(bundle.memorySpaces);
  if (registry === "policies") return writer.writePolicies(bundle.policies);
  if (registry === "agents") return writer.writeAgents(bundle.agents);
  if (registry === "companies") return writer.writeCompanies(bundle.companies);
}

export async function applySelectedRegistryBundleSnapshot(
  snapshot: RegistryBundleSnapshot,
  selected: SnapshotWritableRegistry[],
  writer = new RegistryWriter(),
  loader = new RegistryLoader(),
  auditLogger = new DefaultAuditLogger(),
): Promise<RegistryApplyResult> {
  const applyAttemptId = `registry_apply_${Date.now()}_${randomUUID()}`;
  const targetBundle = importRegistryBundleSnapshot(snapshot);
  const preflight = preflightSelectedRegistryBundleApply(selected);

  if (!preflight.ok) {
    const details = preflight.missingDependencies
      .map((entry) => `${entry.registry} requires [${entry.requires.join(", ")}]`)
      .join("; ");

    await auditLogger.log({
      timestamp: new Date().toISOString(),
      actorId: "registry_snapshot_apply",
      action: "registry_snapshot_apply_preflight_failed",
      resourceId: snapshot.schemaVersion,
      reason: details,
      metadata: {
        applyAttemptId,
        requested: preflight.requested,
        ordered: preflight.ordered,
        missingDependencies: preflight.missingDependencies,
        warnings: preflight.warnings,
      },
    });

    throw new Error(`registry snapshot apply preflight failed: ${details}`);
  }

  const before = await loader.loadAll();
  const applied: SnapshotWritableRegistry[] = [];

  await auditLogger.log({
    timestamp: new Date().toISOString(),
    actorId: "registry_snapshot_apply",
    action: "registry_snapshot_apply_started",
    resourceId: snapshot.schemaVersion,
    reason: `starting snapshot apply for [${preflight.ordered.join(", ")}]`,
    metadata: {
      applyAttemptId,
      requested: preflight.requested,
      ordered: preflight.ordered,
      warnings: preflight.warnings,
    },
  });

  try {
    for (const registry of preflight.ordered) {
      await writeRegistryByName(writer, targetBundle, registry);
      applied.push(registry);
    }

    const result = {
      applied,
      ordered: preflight.ordered,
      rolledBack: [],
      applyAttemptId,
    } satisfies RegistryApplyResult;

    await auditLogger.log({
      timestamp: new Date().toISOString(),
      actorId: "registry_snapshot_apply",
      action: "registry_snapshot_apply_succeeded",
      resourceId: snapshot.schemaVersion,
      reason: `applied snapshot registries [${applied.join(", ")}]`,
      metadata: result,
    });

    return result;
  } catch (err) {
    const rolledBack: SnapshotWritableRegistry[] = [];
    for (const registry of [...applied].reverse()) {
      await writeRegistryByName(writer, before, registry);
      rolledBack.push(registry);
    }
    const message = err instanceof Error ? err.message : String(err);

    await auditLogger.log({
      timestamp: new Date().toISOString(),
      actorId: "registry_snapshot_apply",
      action: "registry_snapshot_apply_failed",
      resourceId: snapshot.schemaVersion,
      reason: message,
      metadata: {
        applyAttemptId,
        requested: preflight.requested,
        ordered: preflight.ordered,
        applied,
        rolledBack,
      },
    });

    throw new Error(`registry snapshot apply failed after [${applied.join(", ")}], rolled back [${rolledBack.join(", ")}]: ${message}`);
  }
}
