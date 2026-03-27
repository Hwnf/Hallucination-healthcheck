import type { PluginEntryOptions } from "./plugin-entry";
import type { HostExpectation } from "./host-negotiation";
import { negotiateHostPluginDescriptor } from "./host-negotiation";
import { loadHostPluginFromManifest } from "./host-loader";
import { HostPluginRegistry, type HostPluginRecord } from "./host-registry";

export interface RegisterHostPluginOptions extends PluginEntryOptions {
  expectation?: HostExpectation;
}

export async function registerHostPluginFromManifest(
  registry: HostPluginRegistry,
  manifestPath: string,
  options: RegisterHostPluginOptions = {},
): Promise<HostPluginRecord> {
  const loaded = await loadHostPluginFromManifest(manifestPath, options);
  const negotiation = options.expectation
    ? negotiateHostPluginDescriptor(loaded.descriptor, options.expectation)
    : null;

  const health = await loaded.descriptor.runtime.health();
  const state = !negotiation?.ok
    ? "rejected"
    : !health.ok
      ? "degraded"
      : "registered";

  return registry.upsert({
    id: loaded.descriptor.id,
    version: loaded.descriptor.version,
    state,
    manifest: loaded.manifest,
    capabilities: loaded.descriptor.capabilities,
    lastNegotiation: negotiation,
    lastHealth: health,
    updatedAt: new Date().toISOString(),
  });
}
