import type { HostPluginDescriptor } from "../interfaces";

export interface HostRegistrationManifest {
  id: string;
  displayName: string;
  version: string;
  protocolVersion: string;
  supportedHooks: Array<"preTurn" | "postTurn" | "health">;
  responseEnvelopes: Array<"HostPreTurnResponse" | "HostPostTurnResponse" | "HostHealthResponse" | "HostPreTurnChunkResponse">;
  features: string[];
  hooks: HostPluginDescriptor["hooks"];
}

export function createHostRegistrationManifest(descriptor: HostPluginDescriptor): HostRegistrationManifest {
  return {
    id: descriptor.id,
    displayName: descriptor.displayName,
    version: descriptor.version,
    protocolVersion: descriptor.capabilities.protocolVersion,
    supportedHooks: descriptor.capabilities.supportedHooks,
    responseEnvelopes: descriptor.capabilities.responseEnvelopes,
    features: descriptor.capabilities.features,
    hooks: descriptor.hooks,
  };
}
