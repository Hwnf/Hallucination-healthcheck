import type { PluginRuntime, ContextResolver, ScopeRouter, RetrievalGate, SupermemoryClient, AclEngine, MetadataBuilder } from "../interfaces";
import type { PluginConfig } from "../types/config";
import { DefaultContextResolver } from "./context-resolver";
import { PreTurnHook } from "./hook-pre-turn";
import { PostTurnHook } from "./hook-post-turn";
import { DefaultScopeRouter } from "../policy/scope-router";
import { DefaultRetrievalGate } from "../policy/retrieval-gate";
import { DefaultAclEngine } from "../policy/acl-engine";
import { DefaultMetadataBuilder } from "../operations/metadata-builder";
import { DefaultSupermemoryClient } from "../integrations/supermemory-client";
import { DefaultPaperclipAdapter, type PaperclipAdapterOptions } from "../integrations/paperclip-adapter";
import { RegistryCache } from "../registries/registry-cache";

export interface PluginRuntimeOptions {
  config: PluginConfig;
  contextResolver?: ContextResolver;
  scopeRouter?: ScopeRouter;
  retrievalGate?: RetrievalGate;
  supermemoryClient?: SupermemoryClient;
  aclEngine?: AclEngine;
  metadataBuilder?: MetadataBuilder;
  registryCache?: RegistryCache;
  paperclip?: PaperclipAdapterOptions;
}

export class DefaultPluginRuntime implements PluginRuntime {
  private readonly registryCache: RegistryCache;
  private readonly preTurnHook: PreTurnHook;
  private readonly postTurnHook: PostTurnHook;

  constructor(private readonly options: PluginRuntimeOptions) {
    this.registryCache = options.registryCache ?? new RegistryCache();

    const contextResolver = options.contextResolver ?? new DefaultContextResolver();
    const scopeRouter = options.scopeRouter ?? new DefaultScopeRouter();
    const retrievalGate = options.retrievalGate ?? new DefaultRetrievalGate();
    const supermemoryClient = options.supermemoryClient ?? new DefaultSupermemoryClient();
    const aclEngine = options.aclEngine ?? new DefaultAclEngine(this.registryCache);
    const metadataBuilder = options.metadataBuilder ?? new DefaultMetadataBuilder();
    const paperclipAdapter = new DefaultPaperclipAdapter(options.paperclip);

    this.preTurnHook = new PreTurnHook(
      contextResolver,
      scopeRouter,
      retrievalGate,
      supermemoryClient,
      aclEngine,
      undefined,
      this.registryCache,
      undefined,
      paperclipAdapter,
    );

    this.postTurnHook = new PostTurnHook(
      contextResolver,
      metadataBuilder,
      supermemoryClient,
      aclEngine,
      undefined,
      undefined,
      undefined,
      paperclipAdapter,
    );
  }

  get config(): PluginConfig {
    return this.options.config;
  }

  async preTurn(input: Parameters<PreTurnHook["run"]>[0]) {
    return this.preTurnHook.run(input);
  }

  async postTurn(input: Parameters<PostTurnHook["run"]>[0]) {
    return this.postTurnHook.run(input);
  }

  async health() {
    await this.registryCache.get();
    return this.registryCache.health();
  }
}
