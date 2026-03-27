import { DefaultAuditLogger, type AuditEvent } from "../operations/audit-logger";
import type { SnapshotWritableRegistry } from "./registry-snapshot";

export interface RegistryApplyReportEntry {
  applyAttemptId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "preflight_failed" | "succeeded" | "failed" | "started" | "in_progress";
  requested: SnapshotWritableRegistry[];
  ordered: SnapshotWritableRegistry[];
  warnings: string[];
  applied: SnapshotWritableRegistry[];
  rolledBack: SnapshotWritableRegistry[];
  reason: string;
  eventActions: string[];
}

function isApplyEvent(event: AuditEvent): boolean {
  return event.actorId === "registry_snapshot_apply" && event.action.startsWith("registry_snapshot_apply_");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function attemptId(event: AuditEvent): string {
  const value = event.metadata?.applyAttemptId;
  return typeof value === "string" && value ? value : `legacy:${event.timestamp}:${event.action}`;
}

function toMillis(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function mergedStatus(actions: string[]): RegistryApplyReportEntry["status"] {
  const hasStarted = actions.includes("registry_snapshot_apply_started");
  const hasSucceeded = actions.includes("registry_snapshot_apply_succeeded");
  const hasFailed = actions.includes("registry_snapshot_apply_failed");
  const hasPreflightFailed = actions.includes("registry_snapshot_apply_preflight_failed");

  if (hasPreflightFailed) return "preflight_failed";
  if (hasSucceeded) return "succeeded";
  if (hasFailed) return "failed";
  if (hasStarted) return "in_progress";
  return "started";
}

function mergeAttempt(events: AuditEvent[]): RegistryApplyReportEntry {
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const firstMeta = first.metadata ?? {};
  const lastMeta = last.metadata ?? {};
  const actions = sorted.map((event) => event.action);

  return {
    applyAttemptId: attemptId(last),
    startedAt: first.timestamp,
    finishedAt: last.timestamp,
    durationMs: Math.max(0, toMillis(last.timestamp) - toMillis(first.timestamp)),
    status: mergedStatus(actions),
    requested: asStringArray(lastMeta.requested ?? firstMeta.requested) as SnapshotWritableRegistry[],
    ordered: asStringArray(lastMeta.ordered ?? firstMeta.ordered) as SnapshotWritableRegistry[],
    warnings: asStringArray(lastMeta.warnings ?? firstMeta.warnings),
    applied: asStringArray(lastMeta.applied) as SnapshotWritableRegistry[],
    rolledBack: asStringArray(lastMeta.rolledBack) as SnapshotWritableRegistry[],
    reason: last.reason,
    eventActions: actions,
  };
}

export class RegistryApplyReportReader {
  constructor(private readonly audit = new DefaultAuditLogger()) {}

  async listRecent(limit = 10): Promise<RegistryApplyReportEntry[]> {
    const grouped = new Map<string, AuditEvent[]>();
    for (const event of (await this.audit.readAll()).filter(isApplyEvent)) {
      const key = attemptId(event);
      const bucket = grouped.get(key) ?? [];
      bucket.push(event);
      grouped.set(key, bucket);
    }

    return [...grouped.values()]
      .map(mergeAttempt)
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
      .slice(0, limit);
  }

  async latest(): Promise<RegistryApplyReportEntry | null> {
    const entries = await this.listRecent(1);
    return entries[0] ?? null;
  }
}
