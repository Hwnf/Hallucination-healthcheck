import { readFile } from "node:fs/promises";
import { writeJsonAtomic } from "../registries/atomic-file";
import { DefaultAuditLogger } from "./audit-logger";

const AGENTS_PATH = "/root/.openclaw/workspace/agents/registry/agents.json";

async function loadJsonArray(path: string): Promise<any[]> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveJson(path: string, data: unknown): Promise<void> {
  await writeJsonAtomic(path, data);
}

export interface BreakGlassRequest {
  agentId: string;
  resourceId: string;
  actions: string[];
  reason: string;
  grantedBy: string;
  ttlMinutes?: number;
}

export interface BreakGlassResult {
  granted: boolean;
  grantId?: string | null;
  expiresAt?: string | null;
  reason: string;
}

function makeGrantId(agentId: string, resourceId: string): string {
  return `break_glass_${agentId}_${resourceId}_${Date.now()}`;
}

/**
 * Break-glass manager.
 *
 * Creates short-lived emergency grants with required reason + audit.
 */
export class DefaultBreakGlassManager {
  constructor(private readonly audit = new DefaultAuditLogger()) {}

  async grant(request: BreakGlassRequest): Promise<BreakGlassResult> {
    if (!request.reason.trim()) {
      return {
        granted: false,
        grantId: null,
        expiresAt: null,
        reason: "break-glass denied: reason is required",
      };
    }

    const ttlMinutes = Math.max(1, Math.min(request.ttlMinutes ?? 15, 120));
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
    const grantId = makeGrantId(request.agentId, request.resourceId);

    const agents = await loadJsonArray(AGENTS_PATH);
    const agent = agents.find((a: any) => a.agent_id === request.agentId);
    if (!agent) {
      return {
        granted: false,
        grantId: null,
        expiresAt: null,
        reason: "break-glass denied: agent not found",
      };
    }

    agent.grants = Array.isArray(agent.grants) ? agent.grants : [];
    agent.grants.push({
      grant_id: grantId,
      subject_type: "agent",
      subject_id: request.agentId,
      resource_id: request.resourceId,
      actions: request.actions,
      effect: "allow",
      reason: `break-glass: ${request.reason}`,
      granted_by: request.grantedBy,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      constraints: { breakGlass: true },
    });

    await saveJson(AGENTS_PATH, agents);

    await this.audit.log({
      timestamp: new Date().toISOString(),
      actorId: request.grantedBy,
      action: "break_glass_grant",
      resourceId: request.resourceId,
      reason: request.reason,
      metadata: {
        targetAgentId: request.agentId,
        actions: request.actions,
        expiresAt,
      },
    });

    return {
      granted: true,
      grantId,
      expiresAt,
      reason: "break-glass grant created",
    };
  }
}
