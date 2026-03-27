import type {
  HostHealthEvent,
  HostHealthResponse,
  HostPostTurnEvent,
  HostPostTurnResponse,
  HostPreTurnEvent,
  HostPreTurnResponse,
} from "./host-events";
import type { HostPluginDescriptor } from "../interfaces";
import { canRunHostActionForRecord, type HostActionPolicyOverrides } from "./host-action-policy";
import type { HostPluginRecord } from "./host-registry";

function blockedResponse(
  pluginId: string,
  hook: "preTurn" | "postTurn" | "health",
  eventId: string | undefined,
  reason: string,
): HostPreTurnResponse | HostPostTurnResponse | HostHealthResponse {
  return {
    pluginId,
    hook,
    eventId,
    emittedAt: new Date().toISOString(),
    ok: false,
    payload: {
      code: `HOST_${hook.toUpperCase()}_BLOCKED`,
      message: reason,
      severity: "warning",
      retryable: false,
    },
  };
}

export class HostExecutionController {
  constructor(
    private readonly descriptor: HostPluginDescriptor,
    private readonly record: HostPluginRecord,
    private readonly policy: HostActionPolicyOverrides = {},
  ) {}

  async handlePreTurnEvent(event: HostPreTurnEvent): Promise<HostPreTurnResponse> {
    const decision = canRunHostActionForRecord(this.record, "preTurn", this.policy);
    if (!decision.allowed) {
      return blockedResponse(this.descriptor.id, "preTurn", event.eventId, decision.reason) as HostPreTurnResponse;
    }
    return this.descriptor.execute.handlePreTurnEvent(event) as Promise<HostPreTurnResponse>;
  }

  async handlePostTurnEvent(event: HostPostTurnEvent): Promise<HostPostTurnResponse> {
    const decision = canRunHostActionForRecord(this.record, "postTurn", this.policy);
    if (!decision.allowed) {
      return blockedResponse(this.descriptor.id, "postTurn", event.eventId, decision.reason) as HostPostTurnResponse;
    }
    return this.descriptor.execute.handlePostTurnEvent(event) as Promise<HostPostTurnResponse>;
  }

  async handleHealthEvent(event?: HostHealthEvent): Promise<HostHealthResponse> {
    const decision = canRunHostActionForRecord(this.record, "health", this.policy);
    if (!decision.allowed) {
      return blockedResponse(this.descriptor.id, "health", event?.eventId, decision.reason) as HostHealthResponse;
    }
    return this.descriptor.execute.handleHealthEvent(event) as Promise<HostHealthResponse>;
  }
}
