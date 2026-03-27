import type { PluginConfig } from "../types/config";

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  memory: {
    provider: "supermemory",
    schemaVersion: "2.0",
    defaultUserContainerPrefix: "user_",
    defaultProjectContainerPrefix: "project_",
    defaultPrivateContainerPrefix: "agent_",
    defaultArchiveContainerPrefix: "archive_project_",
    excludeArchivedByDefault: true,
    excludeSupersededByDefault: true,
    requireAclForRead: true,
    requireAclForWrite: true,
  },
  retrieval: {
    maxResultsPerScope: 5,
    allowColdStorageByDefault: false,
    preferProjectOverCompany: true,
    preferCuratedSummaries: true,
  },
  promotion: {
    manualApprovalRequired: true,
    allowRawTranscriptPromotion: false,
    minConfidenceForProject: 0.65,
    minConfidenceForCompany: 0.75,
    minConfidenceForGovernance: 0.85,
  },
  closeout: {
    freezeOnClosing: true,
    archiveOnComplete: true,
    revokeDefaultProjectAccessOnArchive: true,
  },
  paperclip: {
    mode: "registry",
    sourceOfTruth: "registry-only",
    apiBaseUrl: "http://paperclip.local",
    fallbackToRegistryOnError: true,
    cacheTtlMs: 30000,
  },
};
