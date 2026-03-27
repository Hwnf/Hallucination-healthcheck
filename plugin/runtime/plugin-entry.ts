import type { PluginRuntime, HostPluginDescriptor, ContextResolver, ScopeRouter, RetrievalGate, SupermemoryClient, AclEngine, MetadataBuilder } from "../interfaces";
import type { PluginConfig } from "../types/config";
import { DefaultPluginRuntime } from "./plugin-runtime";
import { DEFAULT_PLUGIN_CONFIG } from "./default-config";
import { RegistryCache } from "../registries/registry-cache";
import { createHostPlugin, type HostPluginOptions } from "./host-plugin";
import type { PaperclipAdapterOptions } from "../integrations/paperclip-adapter";
import type { HostExpectation, HostNegotiationPolicy } from "./host-negotiation";
import { enforceNegotiationPolicy } from "./host-negotiation";

export interface PluginEntryOptions {
  config?: Partial<PluginConfig>;
  contextResolver?: ContextResolver;
  scopeRouter?: ScopeRouter;
  retrievalGate?: RetrievalGate;
  supermemoryClient?: SupermemoryClient;
  aclEngine?: AclEngine;
  metadataBuilder?: MetadataBuilder;
  registryCache?: RegistryCache;
  hostPlugin?: HostPluginOptions;
  paperclip?: PaperclipAdapterOptions;
  hostExpectation?: HostExpectation;
  negotiationPolicy?: HostNegotiationPolicy;
}

function mergeConfig(base: PluginConfig, override?: Partial<PluginConfig>): PluginConfig {
  if (!override) return base;
  return {
    memory: { ...base.memory, ...(override.memory ?? {}) },
    retrieval: { ...base.retrieval, ...(override.retrieval ?? {}) },
    promotion: { ...base.promotion, ...(override.promotion ?? {}) },
    closeout: { ...base.closeout, ...(override.closeout ?? {}) },
    paperclip: { ...base.paperclip, ...(override.paperclip ?? {}) },
  };
}

export function createPluginRuntime(options: PluginEntryOptions = {}): PluginRuntime {
  const config = mergeConfig(DEFAULT_PLUGIN_CONFIG, options.config);
  return new DefaultPluginRuntime({
    config,
    contextResolver: options.contextResolver,
    scopeRouter: options.scopeRouter,
    retrievalGate: options.retrievalGate,
    supermemoryClient: options.supermemoryClient,
    aclEngine: options.aclEngine,
    metadataBuilder: options.metadataBuilder,
    registryCache: options.registryCache,
    paperclip: {
      client: options.paperclip?.client,
      mode: options.paperclip?.mode ?? options.config?.paperclip?.mode ?? config.paperclip?.mode,
      sourceOfTruth: options.paperclip?.sourceOfTruth ?? options.config?.paperclip?.sourceOfTruth ?? config.paperclip?.sourceOfTruth,
      apiBaseUrl: options.paperclip?.apiBaseUrl ?? options.config?.paperclip?.apiBaseUrl ?? config.paperclip?.apiBaseUrl,
      apiKey: options.paperclip?.apiKey,
      fallbackToRegistryOnError: options.paperclip?.fallbackToRegistryOnError ?? options.config?.paperclip?.fallbackToRegistryOnError ?? config.paperclip?.fallbackToRegistryOnError,
      cacheTtlMs: options.paperclip?.cacheTtlMs ?? options.config?.paperclip?.cacheTtlMs ?? config.paperclip?.cacheTtlMs,
    },
  });
}

export function createHostPluginDescriptor(options: PluginEntryOptions = {}): HostPluginDescriptor {
  const runtime = createPluginRuntime(options);
  const descriptor = createHostPlugin(runtime, options.hostPlugin);
  if (options.hostExpectation) {
    enforceNegotiationPolicy(descriptor, options.hostExpectation, options.negotiationPolicy);
  }
  return descriptor;
}
