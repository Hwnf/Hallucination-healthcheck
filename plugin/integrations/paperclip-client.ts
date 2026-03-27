import { readFile } from "node:fs/promises";
import type { ResolvedContext } from "../types/context";

const PROJECTS_PATH = "/root/.openclaw/workspace/agents/registry/projects.json";
const COMPANIES_PATH = "/root/.openclaw/workspace/agents/registry/companies.json";
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

function normalizeEntity(value: any): any | null {
  if (!value || typeof value !== "object") return null;
  return value;
}

export interface PaperclipResolvedState {
  agent: any | null;
  project: any | null;
  company: any | null;
}

export interface PaperclipClient {
  resolveState(context: ResolvedContext): Promise<PaperclipResolvedState>;
}

/**
 * Registry-backed stand-in for Paperclip state.
 *
 * This is the current fallback/test implementation and should remain usable even
 * after a real Paperclip API-backed client exists.
 */
export class RegistryPaperclipClient implements PaperclipClient {
  async resolveState(context: ResolvedContext): Promise<PaperclipResolvedState> {
    const [projects, companies, agents] = await Promise.all([
      loadJsonArray(PROJECTS_PATH),
      loadJsonArray(COMPANIES_PATH),
      loadJsonArray(AGENTS_PATH),
    ]);

    const agent = agents.find((a) => a.agent_id === context.agentId) ?? null;
    const directProject = context.projectId
      ? projects.find((p) => p.project_id === context.projectId)
      : null;

    const inferredProject = !directProject && Array.isArray(agent?.assigned_projects) && agent.assigned_projects.length > 0
      ? projects.find((p) => p.project_id === agent.assigned_projects[0])
      : null;

    const project = directProject ?? inferredProject ?? null;
    const company = context.companyId
      ? companies.find((c) => c.company_id === context.companyId)
      : project?.company_id
        ? companies.find((c) => c.company_id === project.company_id)
        : null;

    return { agent, project, company };
  }
}

export interface ApiPaperclipClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  resolvePath?: string;
}

/**
 * Real Paperclip integration seam.
 *
 * This now implements the request/normalization contract for a future live
 * Paperclip endpoint. The exact live endpoint can still change, but the client
 * boundary and payload normalization behavior are now real and testable.
 */
export class ApiPaperclipClient implements PaperclipClient {
  private readonly fetchImpl: typeof fetch;
  private readonly resolvePath: string;

  constructor(private readonly options: ApiPaperclipClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.resolvePath = options.resolvePath ?? "/v1/runtime/resolve-state";
  }

  async resolveState(context: ResolvedContext): Promise<PaperclipResolvedState> {
    const url = new URL(this.resolvePath, this.options.baseUrl).toString();
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        agentId: context.agentId,
        agentKind: context.agentKind,
        companyId: context.companyId,
        projectId: context.projectId,
        conversationId: context.conversationId,
        provider: context.provider,
        channel: context.channel,
        lifecycleState: context.lifecycleState,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Paperclip API resolve-state failed (${response.status}): ${body || response.statusText}`);
    }

    const payload = await response.json().catch(() => {
      throw new Error("Paperclip API resolve-state returned invalid JSON");
    });

    const state = payload?.state ?? payload ?? {};
    return {
      agent: normalizeEntity(state.agent),
      project: normalizeEntity(state.project),
      company: normalizeEntity(state.company),
    };
  }
}
