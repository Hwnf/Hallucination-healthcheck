import type { PluginEntryOptions } from "./plugin-entry";
import { loadHostPluginFromManifest } from "./host-loader";
import { HostPluginRegistry, type HostPluginRecord } from "./host-registry";

export interface ReconcileHostPluginOptions extends PluginEntryOptions {
  pluginId?: string;
}

export async function reconcileHostPluginFromManifest(
  registry: HostPluginRegistry,
  manifestPath: string,
  options: ReconcileHostPluginOptions = {},
): Promise<HostPluginRecord> {
  const loaded = await loadHostPluginFromManifest(manifestPath, options);
  const existing = registry.get(options.pluginId ?? loaded.descriptor.id);
  const health = await loaded.descriptor.runtime.health();

  const state = existing?.state === "disabled"
    ? "disabled"
    : !health.ok
      ? "degraded"
      : existing?.state === "rejected"
        ? "rejected"
        : "registered";

  return registry.upsert({
    id: options.pluginId ?? loaded.descriptor.id,
    version: loaded.descriptor.version,
    state,
    manifest: loaded.manifest,
    capabilities: loaded.descriptor.capabilities,
    lastNegotiation: existing?.lastNegotiation ?? null,
    lastHealth: health,
    updatedAt: new Date().toISOString(),
  });
}
