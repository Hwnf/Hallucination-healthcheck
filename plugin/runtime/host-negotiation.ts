import type { HostPluginCapabilities, HostPluginDescriptor } from "../interfaces";

export interface HostExpectation {
  protocolVersion?: string;
  requiredHooks?: Array<"preTurn" | "postTurn" | "health">;
  requiredFeatures?: string[];
  requiredResponseEnvelopes?: Array<"HostPreTurnResponse" | "HostPostTurnResponse" | "HostHealthResponse">;
}

export interface HostNegotiationResult {
  ok: boolean;
  reason: string | null;
  missingHooks: string[];
  missingFeatures: string[];
  missingResponseEnvelopes: string[];
  protocolMismatch: boolean;
}

export interface HostNegotiationPolicy {
  mode?: "advisory" | "enforce";
}

function includesAll<T extends string>(have: T[], want: T[] = []): T[] {
  return want.filter((item) => !have.includes(item));
}

export function negotiateHostCapabilities(
  capabilities: HostPluginCapabilities,
  expectation: HostExpectation,
): HostNegotiationResult {
  const missingHooks = includesAll(capabilities.supportedHooks, expectation.requiredHooks);
  const missingFeatures = includesAll(capabilities.features, expectation.requiredFeatures);
  const missingResponseEnvelopes = includesAll(capabilities.responseEnvelopes, expectation.requiredResponseEnvelopes);
  const protocolMismatch = !!expectation.protocolVersion && expectation.protocolVersion !== capabilities.protocolVersion;

  const ok = !protocolMismatch && !missingHooks.length && !missingFeatures.length && !missingResponseEnvelopes.length;
  const parts: string[] = [];
  if (protocolMismatch) parts.push(`protocol mismatch (expected ${expectation.protocolVersion}, got ${capabilities.protocolVersion})`);
  if (missingHooks.length) parts.push(`missing hooks: ${missingHooks.join(", ")}`);
  if (missingFeatures.length) parts.push(`missing features: ${missingFeatures.join(", ")}`);
  if (missingResponseEnvelopes.length) parts.push(`missing response envelopes: ${missingResponseEnvelopes.join(", ")}`);

  return {
    ok,
    reason: ok ? null : parts.join("; "),
    missingHooks,
    missingFeatures,
    missingResponseEnvelopes,
    protocolMismatch,
  };
}

export function negotiateHostPluginDescriptor(
  descriptor: HostPluginDescriptor,
  expectation: HostExpectation,
): HostNegotiationResult {
  return negotiateHostCapabilities(descriptor.capabilities, expectation);
}

export function enforceNegotiationPolicy(
  descriptor: HostPluginDescriptor,
  expectation: HostExpectation,
  policy: HostNegotiationPolicy = {},
): HostNegotiationResult {
  const result = negotiateHostPluginDescriptor(descriptor, expectation);
  if ((policy.mode ?? "advisory") === "advisory") return result;
  if (result.ok) return result;
  throw new Error(`Host/plugin negotiation failed: ${result.reason}`);
}
