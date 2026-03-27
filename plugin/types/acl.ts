export type PermissionAction =
  | "read"
  | "write"
  | "update"
  | "append"
  | "promote"
  | "approve"
  | "archive"
  | "restore"
  | "grant"
  | "revoke"
  | "audit"
  | "delete";

export interface AclGrant {
  grantId: string;
  subjectType: "agent" | "role" | "service";
  subjectId: string;
  resourceId: string;
  actions: PermissionAction[];
  effect: "allow" | "deny";
  reason: string;
  grantedBy: string;
  createdAt: string;
  expiresAt?: string | null;
  constraints?: Record<string, unknown>;
}

export interface AclDecision {
  allowed: boolean;
  action: PermissionAction;
  resourceId: string;
  reason: string;
  matchedRuleId?: string | null;
  requiresAudit: boolean;
}
