export interface PluginConfig {
  memory: {
    provider: "supermemory";
    schemaVersion: "2.0";
    defaultUserContainerPrefix: string;
    defaultProjectContainerPrefix: string;
    defaultPrivateContainerPrefix: string;
    defaultArchiveContainerPrefix: string;
    excludeArchivedByDefault: boolean;
    excludeSupersededByDefault: boolean;
    requireAclForRead: boolean;
    requireAclForWrite: boolean;
  };

  retrieval: {
    maxResultsPerScope: number;
    allowColdStorageByDefault: boolean;
    preferProjectOverCompany: boolean;
    preferCuratedSummaries: boolean;
  };

  promotion: {
    manualApprovalRequired: boolean;
    allowRawTranscriptPromotion: boolean;
    minConfidenceForProject: number;
    minConfidenceForCompany: number;
    minConfidenceForGovernance: number;
  };

  closeout: {
    freezeOnClosing: boolean;
    archiveOnComplete: boolean;
    revokeDefaultProjectAccessOnArchive: boolean;
  };

  paperclip?: {
    mode?: "registry" | "api";
    sourceOfTruth?: "registry-only" | "api-preferred" | "api-only";
    apiBaseUrl?: string;
    fallbackToRegistryOnError?: boolean;
    cacheTtlMs?: number;
  };
}
