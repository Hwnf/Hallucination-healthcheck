export interface ResolvedContext {
  agentId: string;
  agentName: string;
  agentKind: string;

  userId?: string | null;
  conversationId?: string | null;

  companyId?: string | null;
  projectId?: string | null;

  provider: string;
  channel: string;
  surface?: string | null;

  messageId?: string | null;
  taskId?: string | null;

  lifecycleState?: string | null;
  roles?: string[];
  capabilities?: string[];

  paperclipSource?: "api" | "registry" | "registry-fallback" | "cache" | null;
  paperclipSourceOfTruth?: "registry-only" | "api-preferred" | "api-only" | null;
  paperclipDegraded?: boolean;
  paperclipError?: string | null;

  nowIso: string;
}
