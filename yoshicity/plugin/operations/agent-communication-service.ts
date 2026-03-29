import { mkdir, readFile } from "node:fs/promises";
import type { AgentCommunicationService } from "../interfaces";
import type {
  AgentCommunicationMessage,
  AgentCommunicationThread,
  AgentDirectoryEntry,
  AgentInboxFilter,
  AgentInboxItem,
  AgentParticipantRole,
  AgentThreadParticipantState,
  CreateAgentThreadInput,
  MarkAgentThreadReadInput,
  ResolveAgentThreadInput,
  SendAgentMessageInput,
} from "../types/agent-communication";
import { writeJsonAtomic } from "../registries/atomic-file";
import { validateAgentMessages, validateAgentThreads } from "../registries/registry-validation";
import { DefaultAuditLogger } from "./audit-logger";
import { guardRegistryMutation } from "./registry-guard";
import { getAgentDirectory, isAgentVid, isOrchestratorAgentId, validateUniqueAgentExtensions } from "../utils/agent-addressing";
import { getActiveWorkspacePaths } from "../runtime/yoshicity-paths";
import { DefaultInboxIndexService } from "./inbox-index-service";
import { DefaultThreadStoreService } from "./thread-store-service";

const DEFAULT_PATHS = getActiveWorkspacePaths();
const DEFAULT_AGENTS_PATH = DEFAULT_PATHS.agentsPath;
const DEFAULT_THREADS_PATH = DEFAULT_PATHS.threadsPath;
const DEFAULT_MESSAGES_PATH = DEFAULT_PATHS.messagesPath;
const MAX_GROUP_PARTICIPANTS = 4;

export interface AgentCommunicationServicePaths {
  agentsPath?: string;
  threadsPath?: string;
  messagesPath?: string;
  mailboxRoot?: string;
  threadStoreRoot?: string;
}

async function loadJsonArray(path: string): Promise<any[]> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function makeId(prefix: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${nonce}`;
}

function inferThreadStatus(threadType: AgentCommunicationThread["thread_type"], messageType: AgentCommunicationMessage["message_type"], requiresResponse: boolean): AgentCommunicationThread["status"] {
  if (requiresResponse) {
    if (threadType === "group" || threadType === "deliberation") return "collecting_inputs";
    return "waiting";
  }
  if (messageType === "summary") return "awaiting_decision";
  if (messageType === "decision") return "answered";
  if (messageType === "proposal" || messageType === "objection" || messageType === "deliberation") return "in_deliberation";
  if (messageType === "answer" || messageType === "approval_response" || messageType === "status_update") return "answered";
  return "open";
}

function buildParticipantState(
  participants: string[],
  sender: string,
  recipients: string[],
  requiresResponse: boolean,
  messageId: string,
  nowIso: string,
  roles: Record<string, AgentParticipantRole>,
  requiredResponders: string[],
): AgentThreadParticipantState[] {
  return unique(participants).map((agentId) => ({
    agent_id: agentId,
    role: roles[agentId] ?? (agentId === sender ? "initiator" : "responder"),
    response_required: requiredResponders.includes(agentId) || (recipients.includes(agentId) && requiresResponse),
    has_responded: agentId === sender,
    unread_count: recipients.includes(agentId) ? 1 : 0,
    last_read_at: agentId === sender ? nowIso : null,
    last_read_message_id: agentId === sender ? messageId : null,
    pending_response: (requiredResponders.includes(agentId) || recipients.includes(agentId)) ? requiresResponse : false,
  }));
}

export class DefaultAgentCommunicationService implements AgentCommunicationService {
  private readonly agentsPath: string;
  private readonly threadsPath: string;
  private readonly messagesPath: string;
  private readonly mailboxRoot: string;
  private readonly threadStoreRoot: string;

  constructor(
    private readonly auditLogger = new DefaultAuditLogger(),
    paths: AgentCommunicationServicePaths = {},
  ) {
    this.agentsPath = paths.agentsPath ?? DEFAULT_AGENTS_PATH;
    this.threadsPath = paths.threadsPath ?? DEFAULT_THREADS_PATH;
    this.messagesPath = paths.messagesPath ?? DEFAULT_MESSAGES_PATH;
    this.mailboxRoot = paths.mailboxRoot ?? DEFAULT_PATHS.mailboxRoot;
    this.threadStoreRoot = paths.threadStoreRoot ?? `${DEFAULT_PATHS.workspaceRoot}/yoshicity/threads`;
  }

  private async ensureRegistryFiles(): Promise<void> {
    await mkdir(DEFAULT_PATHS.registryRoot, { recursive: true });
    try {
      await readFile(this.threadsPath, "utf8");
    } catch {
      await this.saveThreads([]);
    }
    try {
      await readFile(this.messagesPath, "utf8");
    } catch {
      await this.saveMessages([]);
    }
  }

  private async saveThreads(items: AgentCommunicationThread[]): Promise<void> {
    validateAgentThreads(items);
    await writeJsonAtomic(this.threadsPath, items);
  }

  private async saveMessages(items: AgentCommunicationMessage[]): Promise<void> {
    validateAgentMessages(items);
    await writeJsonAtomic(this.messagesPath, items);
  }

  private async loadAgents(): Promise<any[]> {
    return loadJsonArray(this.agentsPath);
  }

  private async loadThreads(): Promise<AgentCommunicationThread[]> {
    await this.ensureRegistryFiles();
    return loadJsonArray(this.threadsPath) as AgentCommunicationThread[];
  }

  private async loadMessages(): Promise<AgentCommunicationMessage[]> {
    await this.ensureRegistryFiles();
    return loadJsonArray(this.messagesPath) as AgentCommunicationMessage[];
  }

  private async resolveAgentAddress(address: string): Promise<string> {
    const agents = await this.loadAgents();
    const normalized = String(address ?? "").trim();
    if (!normalized) throw new Error("agent address must be non-empty");

    const byId = agents.find((agent) => agent.agent_id === normalized);
    if (byId) return byId.agent_id;

    if (isAgentVid(normalized)) {
      const byVid = agents.find((agent) => (agent.v_id ?? agent.extension) === normalized);
      if (byVid) return byVid.agent_id;
    }

    throw new Error(`unknown agent address: ${address}`);
  }

  private async resolveAgentAddresses(addresses: string[]): Promise<string[]> {
    const resolvedSets = await Promise.all(addresses.map(async (address) => {
      const normalized=String(address||"").trim();
      if (normalized.startsWith("role:")||normalized.startsWith("class:")) {
        const grp = await (await import("../utils/agent-addressing")).resolveGroupAddress(normalized, this.agentsPath);
        return grp;
      }
      const single = await this.resolveAgentAddress(address);
      return single ? [single] : [];
    }));
    const flat = resolvedSets.flat();
    return unique(flat);
  }

  private async getAgentRecord(agentId: string): Promise<any | null> {
    const agents = await this.loadAgents();
    return agents.find((agent) => agent.agent_id === agentId) ?? null;
  }

  private async canAccessThread(thread: AgentCommunicationThread, viewerAgentId: string): Promise<boolean> {
    if (thread.participants.includes(viewerAgentId)) return true;
    if (isOrchestratorAgentId(viewerAgentId)) return true;

    const viewer = await this.getAgentRecord(viewerAgentId);
    if (!viewer) return false;
    const viewerProjects = Array.isArray(viewer.assigned_projects) ? viewer.assigned_projects : [];

    if (thread.visibility === "participants_only") return false;
    if (thread.visibility === "orchestrator_visible") return false;
    if (thread.visibility === "project_visible") {
      return !!thread.project_id && viewerProjects.includes(thread.project_id);
    }
    return false;
  }

  private async validateParticipants(
    senderAgentId: string,
    recipientAgentIds: string[],
    projectId?: string | null,
    existingThreadParticipants?: string[],
  ): Promise<void> {
    const agents = await this.loadAgents();
    const sender = agents.find((agent) => agent.agent_id === senderAgentId);
    if (!sender) throw new Error(`unknown sender agent: ${senderAgentId}`);

    for (const recipientId of recipientAgentIds) {
      const recipient = agents.find((agent) => agent.agent_id === recipientId);
      if (!recipient) throw new Error(`unknown recipient agent: ${recipientId}`);
      if (recipient.agent_id === senderAgentId) continue;
      if (isOrchestratorAgentId(senderAgentId) || isOrchestratorAgentId(String(recipient.agent_id))) continue;
      if (existingThreadParticipants?.includes(senderAgentId) && existingThreadParticipants?.includes(recipientId)) continue;

      const senderProjects = Array.isArray(sender.assigned_projects) ? sender.assigned_projects : [];
      const recipientProjects = Array.isArray(recipient.assigned_projects) ? recipient.assigned_projects : [];
      const sharedProject = projectId
        ? senderProjects.includes(projectId) && recipientProjects.includes(projectId)
        : senderProjects.some((id: string) => recipientProjects.includes(id));

      if (!sharedProject) {
        throw new Error(`cross-project direct messaging denied between ${senderAgentId} and ${recipientId}`);
      }
    }
  }

  private async syncMailboxV3Views(thread: AgentCommunicationThread): Promise<void> {
    const inboxIndexService = new DefaultInboxIndexService({
      agentsPath: this.agentsPath,
      threadsPath: this.threadsPath,
      messagesPath: this.messagesPath,
      mailboxRoot: this.mailboxRoot,
    });
    const threadStoreService = new DefaultThreadStoreService({
      threadsPath: this.threadsPath,
      messagesPath: this.messagesPath,
      threadStoreRoot: this.threadStoreRoot,
    });

    await threadStoreService.materializeThread(thread.thread_id);
    for (const participant of thread.participants) {
      await inboxIndexService.generateForAgent(participant);
    }
  }

  async reconcileMailboxV3ForThread(threadId: string): Promise<void> {
    const threads = await this.loadThreads();
    const thread = threads.find((item) => item.thread_id === threadId);
    if (!thread) throw new Error(`unknown thread: ${threadId}`);
    await this.syncMailboxV3Views(thread);
  }

  async reconcileMailboxV3ForAgent(agentId: string): Promise<void> {
    const resolvedAgentId = await this.resolveAgentAddress(agentId);
    const inboxIndexService = new DefaultInboxIndexService({
      agentsPath: this.agentsPath,
      threadsPath: this.threadsPath,
      messagesPath: this.messagesPath,
      mailboxRoot: this.mailboxRoot,
    });
    const threadStoreService = new DefaultThreadStoreService({
      threadsPath: this.threadsPath,
      messagesPath: this.messagesPath,
      threadStoreRoot: this.threadStoreRoot,
    });
    const threads = await this.loadThreads();
    for (const thread of threads.filter((item) => item.participants.includes(resolvedAgentId))) {
      await threadStoreService.materializeThread(thread.thread_id);
    }
    await inboxIndexService.generateForAgent(resolvedAgentId);
  }

  private updateThreadStateForMessage(thread: AgentCommunicationThread, message: AgentCommunicationMessage): AgentCommunicationThread {
    const participants = unique([...thread.participants, message.sender_agent_id, ...message.recipient_agent_ids]);
    const existing = new Map((thread.participant_state ?? []).map((state) => [state.agent_id, state]));

    const nextState: AgentThreadParticipantState[] = participants.map((agentId) => {
      const prior = existing.get(agentId);
      const isSender = agentId === message.sender_agent_id;
      const isRecipient = message.recipient_agent_ids.includes(agentId);
      return {
        agent_id: agentId,
        role: prior?.role ?? (agentId === message.sender_agent_id ? "initiator" : "responder"),
        response_required: prior?.response_required ?? false,
        has_responded: isSender ? true : (prior?.has_responded ?? false),
        unread_count: isSender ? 0 : (prior?.unread_count ?? 0) + (isRecipient ? 1 : 0),
        last_read_at: isSender ? message.created_at : (prior?.last_read_at ?? null),
        last_read_message_id: isSender ? message.message_id : (prior?.last_read_message_id ?? null),
        pending_response: isSender
          ? false
          : (prior?.response_required ?? false)
            ? !(prior?.has_responded ?? false)
            : isRecipient
              ? !!message.requires_response
              : (prior?.pending_response ?? false),
      };
    });

    thread.participants = participants;
    thread.participant_state = nextState;
    thread.updated_at = message.created_at;
    thread.status = inferThreadStatus(thread.thread_type, message.message_type, message.requires_response);
    return thread;
  }

  async createThread(input: CreateAgentThreadInput): Promise<{ thread: AgentCommunicationThread; firstMessage: AgentCommunicationMessage }> {
    const guard = await guardRegistryMutation(["agents"], "agent communication thread create");
    if (!guard.allowed) throw new Error(guard.reason ?? "agent communication unavailable due to degraded registry health");
    await validateUniqueAgentExtensions(this.agentsPath);

    const createdBy = await this.resolveAgentAddress(input.createdBy);
    const participantIds = await this.resolveAgentAddresses(input.participants);
    const recipientIds = await this.resolveAgentAddresses(input.initialMessage.recipientAgentIds);
    const participants = unique([createdBy, ...participantIds, ...recipientIds]);

    if ((input.threadType === "group" || input.threadType === "deliberation") && participants.length > MAX_GROUP_PARTICIPANTS) {
      throw new Error(`group/deliberation threads support at most ${MAX_GROUP_PARTICIPANTS} agents`);
    }

    await this.validateParticipants(createdBy, recipientIds, input.projectId);

    const roleEntries = Object.entries(input.participantRoles ?? {});
    const resolvedRoles = Object.fromEntries(await Promise.all(roleEntries.map(async ([address, role]) => [await this.resolveAgentAddress(address), role])));
    const requiredResponders = await this.resolveAgentAddresses(input.requiredResponders ?? input.initialMessage.recipientAgentIds);

    const nowIso = new Date().toISOString();
    const firstMessage: AgentCommunicationMessage = {
      message_id: makeId("msg"),
      thread_id: makeId("thread"),
      sender_agent_id: createdBy,
      recipient_agent_ids: recipientIds,
      message_type: input.initialMessage.messageType,
      body: input.initialMessage.body,
      summary: input.initialMessage.summary ?? null,
      requires_response: input.initialMessage.requiresResponse ?? true,
      priority: input.initialMessage.priority ?? "normal",
      created_at: nowIso,
      reply_to_message_id: null,
      metadata: null,
      schema_version: "2.0",
    };

    const thread: AgentCommunicationThread = {
      thread_id: firstMessage.thread_id,
      subject: input.subject,
      thread_type: input.threadType,
      status: inferThreadStatus(input.threadType, firstMessage.message_type, firstMessage.requires_response),
      created_by: createdBy,
      participants,
      visibility: input.visibility ?? "participants_only",
      project_id: input.projectId ?? null,
      company_id: input.companyId ?? null,
      conversation_id: input.conversationId ?? null,
      participant_state: buildParticipantState(participants, createdBy, firstMessage.recipient_agent_ids, firstMessage.requires_response, firstMessage.message_id, nowIso, resolvedRoles, requiredResponders),
      created_at: nowIso,
      updated_at: nowIso,
      resolved_at: null,
      resolved_by: null,
      schema_version: "2.0",
    };

    const threads = await this.loadThreads();
    const messages = await this.loadMessages();
    threads.push(thread);
    messages.push(firstMessage);
    await this.saveThreads(threads);
    await this.saveMessages(messages);
    await this.auditLogger.log({
      timestamp: firstMessage.created_at,
      actorId: createdBy,
      action: "agent_message_sent",
      resourceId: thread.thread_id,
      reason: `agent message sent in thread ${thread.thread_id}`,
      metadata: {
        recipients: firstMessage.recipient_agent_ids,
        messageType: firstMessage.message_type,
        priority: firstMessage.priority,
        requiresResponse: firstMessage.requires_response,
        threadStatus: thread.status,
        threadType: thread.thread_type,
      },
    });

    await this.syncMailboxV3Views(thread);
    return { thread, firstMessage };
  }

  async placeCall(input: {
    from: string;
    to: string[];
    subject: string;
    body: string;
    threadType?: CreateAgentThreadInput["threadType"];
    visibility?: CreateAgentThreadInput["visibility"];
    requiresResponse?: boolean;
    priority?: CreateAgentThreadInput["initialMessage"]["priority"];
    projectId?: string | null;
    companyId?: string | null;
    conversationId?: string | null;
  }): Promise<{ thread: AgentCommunicationThread; firstMessage: AgentCommunicationMessage }> {
    return this.createThread({
      createdBy: input.from,
      subject: input.subject,
      threadType: input.threadType ?? (input.to.length > 1 ? "group" : "direct"),
      participants: input.to,
      visibility: input.visibility ?? "participants_only",
      initialMessage: {
        recipientAgentIds: input.to,
        messageType: "question",
        body: input.body,
        requiresResponse: input.requiresResponse ?? true,
        priority: input.priority ?? "normal",
      },
      projectId: input.projectId ?? null,
      companyId: input.companyId ?? null,
      conversationId: input.conversationId ?? null,
    });
  }

  async sendMessage(input: SendAgentMessageInput): Promise<AgentCommunicationMessage> {
    const threads = await this.loadThreads();
    const messages = await this.loadMessages();
    const senderAgentId = await this.resolveAgentAddress(input.senderAgentId);
    const recipientAgentIds = await this.resolveAgentAddresses(input.recipientAgentIds);
    const thread = threads.find((item) => item.thread_id === input.threadId);
    if (!thread) throw new Error(`unknown thread: ${input.threadId}`);
    if (thread.status === "archived") throw new Error(`thread is archived: ${input.threadId}`);
    if (!(await this.canAccessThread(thread, senderAgentId))) throw new Error(`sender cannot access thread: ${input.threadId}`);
    if ((thread.thread_type === "group" || thread.thread_type === "deliberation") && thread.participants.length > MAX_GROUP_PARTICIPANTS) {
      throw new Error(`thread exceeds max supported group size of ${MAX_GROUP_PARTICIPANTS}`);
    }
    await this.validateParticipants(senderAgentId, recipientAgentIds, thread.project_id ?? null, thread.participants);

    const message: AgentCommunicationMessage = {
      message_id: makeId("msg"),
      thread_id: input.threadId,
      sender_agent_id: senderAgentId,
      recipient_agent_ids: recipientAgentIds,
      message_type: input.messageType,
      body: input.body,
      summary: input.summary ?? null,
      requires_response: input.requiresResponse ?? false,
      priority: input.priority ?? "normal",
      created_at: new Date().toISOString(),
      reply_to_message_id: input.replyToMessageId ?? null,
      metadata: input.metadata ?? null,
      schema_version: "2.0",
    };

    this.updateThreadStateForMessage(thread, message);
    messages.push(message);
    await this.saveThreads(threads);
    await this.saveMessages(messages);
    await this.auditLogger.log({
      timestamp: message.created_at,
      actorId: senderAgentId,
      action: "agent_message_sent",
      resourceId: input.threadId,
      reason: `agent message sent in thread ${input.threadId}`,
      metadata: {
        recipients: message.recipient_agent_ids,
        messageType: message.message_type,
        priority: message.priority,
        requiresResponse: message.requires_response,
        threadStatus: thread.status,
        threadType: thread.thread_type,
      },
    });

    // Optional auto-ACK (off by default). Enable by setting AUTO_ACK_ENABLED='true' in the environment.
    if (process.env.AUTO_ACK_ENABLED === 'true') {
      try {
        for (const recip of message.recipient_agent_ids) {
          const ack: AgentCommunicationMessage = {
            message_id: makeId('msg'),
            thread_id: message.thread_id,
            sender_agent_id: recip,
            recipient_agent_ids: [senderAgentId],
            message_type: 'ack',
            body: `ACK: received ${new Date().toISOString()}`,
            summary: null,
            requires_response: false,
            priority: 'normal',
            created_at: new Date().toISOString(),
            reply_to_message_id: message.message_id,
            metadata: { auto_ack: true },
            schema_version: '2.0',
          };
          messages.push(ack);
        }
        // persist the ack messages
        await this.saveMessages(messages);
      } catch (e) {
        // non-fatal: continue without failing the send
      }
    }

    await this.syncMailboxV3Views(thread);
    return message;
  }

  async reply(input: SendAgentMessageInput): Promise<AgentCommunicationMessage> {
    return this.sendMessage(input);
  }

  async listInbox(agentId: string, filter: AgentInboxFilter = {}): Promise<AgentInboxItem[]> {
    const resolvedAgentId = await this.resolveAgentAddress(agentId);
    const threads = await this.loadThreads();
    const messages = await this.loadMessages();
    return threads
      .filter((thread) => thread.participants.includes(resolvedAgentId))
      .map((thread) => {
        const threadMessages = messages.filter((message) => message.thread_id === thread.thread_id);
        const lastMessage = threadMessages.at(-1) ?? null;
        const participantState = thread.participant_state?.find((state) => state.agent_id === resolvedAgentId);
        return {
          thread,
          lastMessage,
          pendingResponse: participantState?.pending_response ?? false,
          unreadCount: participantState?.unread_count ?? 0,
        };
      })
      .filter((item) => !filter.unreadOnly || item.unreadCount > 0)
      .filter((item) => !filter.pendingOnly || item.pendingResponse)
      .filter((item) => !filter.projectId || item.thread.project_id === filter.projectId)
      .filter((item) => !filter.status || item.thread.status === filter.status)
      .sort((a, b) => {
        const unreadDelta = b.unreadCount - a.unreadCount;
        if (unreadDelta !== 0) return unreadDelta;
        return String(b.thread.updated_at).localeCompare(String(a.thread.updated_at));
      });
  }

  async getLatestInboundMessage(agentId: string): Promise<AgentInboundMessageView | null> {
    const resolvedAgentId = await this.resolveAgentAddress(agentId);
    const threads = await this.loadThreads();
    const messages = await this.loadMessages();

    const inbound = messages
      .filter((message) => message.recipient_agent_ids.includes(resolvedAgentId))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const message = inbound[0] ?? null;
    if (!message) return null;

    const thread = threads.find((item) => item.thread_id === message.thread_id) ?? null;
    if (!thread) return null;
    if (!(await this.canAccessThread(thread, resolvedAgentId))) return null;

    await this.syncMailboxV3Views(thread);
    return { thread, message };
  }

  async getThread(threadId: string, viewerAgentId?: string): Promise<{ thread: AgentCommunicationThread | null; messages: AgentCommunicationMessage[] }> {
    const threads = await this.loadThreads();
    const messages = await this.loadMessages();
    const thread = threads.find((item) => item.thread_id === threadId) ?? null;
    if (!thread) return { thread: null, messages: [] };
    if (viewerAgentId) {
      const viewer = await this.resolveAgentAddress(viewerAgentId);
      if (!(await this.canAccessThread(thread, viewer))) {
        throw new Error(`viewer cannot access thread: ${threadId}`);
      }
    }
    return {
      thread,
      messages: messages.filter((message) => message.thread_id === threadId),
    };
  }

  async listDirectory(viewerAgentId?: string): Promise<AgentDirectoryEntry[]> {
    if (viewerAgentId) {
      await this.resolveAgentAddress(viewerAgentId);
    }
    await validateUniqueAgentExtensions(this.agentsPath);
    return getAgentDirectory(this.agentsPath);
  }

  async markThreadRead(input: MarkAgentThreadReadInput): Promise<AgentCommunicationThread> {
    const resolvedAgentId = await this.resolveAgentAddress(input.agentId);
    const threads = await this.loadThreads();
    const messages = await this.loadMessages();
    const thread = threads.find((item) => item.thread_id === input.threadId);
    if (!thread) throw new Error(`unknown thread: ${input.threadId}`);
    if (!(await this.canAccessThread(thread, resolvedAgentId))) throw new Error(`agent cannot access thread: ${input.threadId}`);

    const lastMessage = messages.filter((message) => message.thread_id === input.threadId).at(-1) ?? null;
    const readAt = input.readAt ?? new Date().toISOString();
    const lastReadMessageId = input.lastReadMessageId ?? lastMessage?.message_id ?? null;
    thread.participant_state = (thread.participant_state ?? []).map((state) => state.agent_id === resolvedAgentId
      ? {
          ...state,
          unread_count: 0,
          last_read_at: readAt,
          last_read_message_id: lastReadMessageId,
        }
      : state);
    await this.saveThreads(threads);
    await this.auditLogger.log({
      timestamp: readAt,
      actorId: resolvedAgentId,
      action: "agent_thread_read",
      resourceId: input.threadId,
      reason: `agent marked thread read`,
      metadata: { lastReadMessageId },
    });
    await this.syncMailboxV3Views(thread);
    return thread;
  }

  async resolveThread(input: ResolveAgentThreadInput): Promise<AgentCommunicationThread> {
    const resolvedBy = await this.resolveAgentAddress(input.resolvedBy);
    const threads = await this.loadThreads();
    const thread = threads.find((item) => item.thread_id === input.threadId);
    if (!thread) throw new Error(`unknown thread: ${input.threadId}`);
    if (!(await this.canAccessThread(thread, resolvedBy))) throw new Error(`resolver cannot access thread: ${input.threadId}`);
    thread.status = input.status;
    thread.updated_at = new Date().toISOString();
    thread.resolved_at = thread.updated_at;
    thread.resolved_by = resolvedBy;
    thread.participant_state = (thread.participant_state ?? []).map((state) => ({ ...state, pending_response: false }));
    await this.saveThreads(threads);
    await this.auditLogger.log({
      timestamp: thread.updated_at,
      actorId: resolvedBy,
      action: "agent_thread_resolved",
      resourceId: input.threadId,
      reason: `agent thread marked ${input.status}`,
      metadata: { status: input.status },
    });
    await this.syncMailboxV3Views(thread);
    return thread;
  }

  // Create a proposal (deliberation thread) with project-visible default when projectId provided
  async createProposal(params: {
    createdBy: string;
    subject: string;
    body: string;
    invited: string[]; // supports role: or agent ids
    projectId?: string | null;
    visibility?: CreateAgentThreadInput['visibility'];
    mode?: 'proposal'|'deliberation'|'call';
  }): Promise<{ threadId: string; firstMessageId: string }>{
    const mode = params.mode ?? (params.projectId ? 'proposal' : 'deliberation');
    const visibility = params.visibility ?? (params.projectId ? 'project_visible' : 'participants_only');
    // resolve invited addresses (resolveAgentAddresses already expands role:)
    const participantIds = await this.resolveAgentAddresses(params.invited);
    // include creator
    const createdBy = params.createdBy;

    const initialMsgType = mode === 'proposal' ? 'proposal' : 'question';
    const requiresResponse = mode === 'proposal' || mode === 'call';

    const input: CreateAgentThreadInput = {
      createdBy,
      subject: params.subject,
      threadType: mode === 'call' ? (participantIds.length>1? 'group':'direct') : 'deliberation',
      participants: participantIds,
      visibility: visibility,
      participantRoles: {},
      requiredResponders: [],
      initialMessage: {
        recipientAgentIds: participantIds,
        messageType: initialMsgType as any,
        body: params.body,
        requiresResponse: requiresResponse,
        priority: 'normal',
      },
      projectId: params.projectId ?? null,
    };

    const { thread, firstMessage } = await this.createThread(input);

    // call-mode extras: mark mailboxes active and tag thread metadata with call marker
    if (mode === 'call') {
      try {
        const { DefaultAgentMailboxService } = await import('./agent-mailbox-service');
        const mailboxService = new DefaultAgentMailboxService();
        for (const p of participantIds) {
          await mailboxService.setMailboxStatus(p, 'active');
        }
      } catch (e) {
        // non-fatal: mailbox status update is best-effort
      }
    }

    return { threadId: thread.thread_id, firstMessageId: firstMessage.message_id };
  }

  // Resolve with decision: attach decision message and write a decision JSON artifact to archives
  async resolveWithDecision(params: { threadId: string; resolvedBy: string; status: 'resolved'|'answered'|'archived'|'blocked'; decisionSummary: string }): Promise<{ threadId: string; decisionPath: string }> {
    // mark resolved in thread
    await this.resolveThread({ threadId: params.threadId, resolvedBy: params.resolvedBy, status: params.status });
    // add a final decision message
    const decisionMessage = await this.sendMessage({
      threadId: params.threadId,
      senderAgentId: params.resolvedBy,
      recipientAgentIds: [],
      messageType: 'decision',
      body: params.decisionSummary,
      requiresResponse: false,
      priority: 'normal',
    });

    // materialize thread store and then write an archive decision JSON
    const threadStoreService = new DefaultThreadStoreService({ threadsPath: this.threadsPath, messagesPath: this.messagesPath, threadStoreRoot: this.threadStoreRoot });
    const record = await threadStoreService.materializeThread(params.threadId);

    // place decision artifact in the same Yoshi City archive folder as other migration artifacts
    const threadStoreDir = this.threadStoreRoot; // e.g. .../yoshicity/threads
    const archiveDir = threadStoreDir.replace(/\/threads$/, '') + '/archives';
    const archivePath = `${archiveDir}/${params.threadId}.decision.json`;
    const decisionRecord = {
      thread_id: record.thread_id,
      subject: record.subject,
      project_id: record.project_id ?? null,
      resolved_at: new Date().toISOString(),
      resolved_by: params.resolvedBy,
      decision_message_id: decisionMessage.message_id,
      decision_summary: params.decisionSummary,
      contributors: record.participants,
    };
    await writeJsonAtomic(archivePath, decisionRecord);
    return { threadId: params.threadId, decisionPath: archivePath };
  }
  // Soft wake: mark mailbox active and send a lightweight ping (best-effort)
  async forceWake(agentId: string): Promise<{ ok: boolean, reason?: string }> {
    try {
      const resolved = await this.resolveAgentAddress(agentId);
      if (!resolved) return { ok: false, reason: 'unknown agent' };
      const { DefaultAgentMailboxService } = await import('./agent-mailbox-service');
      const mailboxService = new DefaultAgentMailboxService();
      await mailboxService.setMailboxStatus(resolved, 'active');
      // create a short direct ping thread
      const { thread } = await this.createThread({
        createdBy: '0000',
        subject: 'Wake ping',
        threadType: 'direct',
        participants: [resolved],
        visibility: 'participants_only',
        participantRoles: {},
        requiredResponders: [],
        initialMessage: {
          recipientAgentIds: [resolved],
          messageType: 'status_update',
          body: 'Wake ping: please attend the live call if available.',
          requiresResponse: false,
          priority: 'normal',
        },
      });
      // materialize and update indexes for the single participant
      await this.syncMailboxV3Views(thread);
      await this.auditLogger.log({ timestamp: new Date().toISOString(), actorId: '0000', action: 'force_wake', resourceId: resolved, reason: 'soft wake ping', metadata: { thread: thread.thread_id } });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  }

}
