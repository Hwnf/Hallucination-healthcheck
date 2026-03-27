import { mkdir, appendFile, readFile } from "node:fs/promises";

export interface AuditEvent {
  timestamp: string;
  actorId: string;
  action: string;
  resourceId?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
}

const AUDIT_DIR = "/root/.openclaw/workspace/plugin/audit";
const AUDIT_LOG = `${AUDIT_DIR}/audit.log`;

/**
 * Durable append-only audit logger.
 *
 * Format:
 * - one JSON object per line (JSONL)
 * - append-only local file
 */
export class DefaultAuditLogger {
  async log(event: AuditEvent): Promise<void> {
    await mkdir(AUDIT_DIR, { recursive: true });
    const line = JSON.stringify({
      timestamp: event.timestamp,
      actorId: event.actorId,
      action: event.action,
      resourceId: event.resourceId ?? null,
      reason: event.reason,
      metadata: event.metadata ?? {},
    }) + "\n";
    await appendFile(AUDIT_LOG, line, "utf8");
  }

  async readAll(): Promise<AuditEvent[]> {
    try {
      const raw = await readFile(AUDIT_LOG, "utf8");
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  path(): string {
    return AUDIT_LOG;
  }
}
