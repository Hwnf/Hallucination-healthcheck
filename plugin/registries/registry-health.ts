export interface RegistryIssue {
  registry: string;
  path: string;
  severity: "warning" | "error";
  message: string;
}

export interface RegistryHealth {
  ok: boolean;
  issues: RegistryIssue[];
  loadedAt: string;
}
