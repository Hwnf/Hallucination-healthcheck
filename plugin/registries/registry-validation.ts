function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function ensureArray(name: string, items: unknown): unknown[] {
  if (!Array.isArray(items)) throw new Error(`${name} must be an array`);
  return items;
}

function ensureString(name: string, value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function ensureOptionalString(name: string, value: unknown): void {
  if (value == null) return;
  if (typeof value !== "string") throw new Error(`${name} must be a string when provided`);
}

function ensureOptionalStringArray(name: string, value: unknown): void {
  if (value == null) return;
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new Error(`${name} must be an array of strings when provided`);
  }
}

export function validatePromotions(items: unknown[]): void {
  for (const [i, item] of ensureArray("promotions", items).entries()) {
    if (!isObject(item)) throw new Error(`promotions[${i}] must be an object`);
    ensureString(`promotions[${i}].promotion_id`, item.promotion_id);
    ensureString(`promotions[${i}].from_memory_id`, item.from_memory_id);
    ensureString(`promotions[${i}].from_scope`, item.from_scope);
    ensureString(`promotions[${i}].to_scope`, item.to_scope);
    ensureString(`promotions[${i}].to_memory_id`, item.to_memory_id);
    ensureString(`promotions[${i}].canonical_key`, item.canonical_key);
    ensureString(`promotions[${i}].requested_by`, item.requested_by);
    ensureString(`promotions[${i}].reason`, item.reason);
    ensureString(`promotions[${i}].status`, item.status);
    ensureString(`promotions[${i}].timestamp`, item.timestamp);
    ensureOptionalString(`promotions[${i}].approved_by`, item.approved_by);
    ensureOptionalString(`promotions[${i}].created_memory_id`, item.created_memory_id);
    ensureOptionalStringArray(`promotions[${i}].derived_from`, item.derived_from);
  }
}

export function validateArchives(items: unknown[]): void {
  for (const [i, item] of ensureArray("archives", items).entries()) {
    if (!isObject(item)) throw new Error(`archives[${i}] must be an object`);
    ensureString(`archives[${i}].archive_id`, item.archive_id);
    ensureString(`archives[${i}].project_id`, item.project_id);
    ensureString(`archives[${i}].archive_memory_id`, item.archive_memory_id);
    ensureString(`archives[${i}].status`, item.status);
    ensureString(`archives[${i}].archived_by`, item.archived_by);
    ensureString(`archives[${i}].archived_at`, item.archived_at);
    ensureOptionalString(`archives[${i}].summary_ref`, item.summary_ref);
    ensureOptionalString(`archives[${i}].decision_index_ref`, item.decision_index_ref);
    ensureOptionalString(`archives[${i}].artifact_index_ref`, item.artifact_index_ref);
  }
}

export function validateExperienceIndex(items: unknown[]): void {
  for (const [i, item] of ensureArray("experienceIndex", items).entries()) {
    if (!isObject(item)) throw new Error(`experienceIndex[${i}] must be an object`);
    ensureString(`experienceIndex[${i}].experience_owner`, item.experience_owner);
    ensureString(`experienceIndex[${i}].file`, item.file);
    ensureOptionalStringArray(`experienceIndex[${i}].lesson_keys`, item.lesson_keys);
    ensureOptionalString(`experienceIndex[${i}].last_updated`, item.last_updated);
  }
}

export function validateContradictions(items: unknown[]): void {
  for (const [i, item] of ensureArray("contradictions", items).entries()) {
    if (!isObject(item)) throw new Error(`contradictions[${i}] must be an object`);
    ensureString(`contradictions[${i}].contradiction_set_id`, item.contradiction_set_id);
    ensureOptionalStringArray(`contradictions[${i}].memory_ids`, item.memory_ids);
    ensureOptionalString(`contradictions[${i}].entity_key`, item.entity_key);
    ensureOptionalString(`contradictions[${i}].fact_key`, item.fact_key);
    ensureString(`contradictions[${i}].resolution_state`, item.resolution_state);
    ensureOptionalString(`contradictions[${i}].winner_memory_id`, item.winner_memory_id);
    ensureOptionalString(`contradictions[${i}].resolution_reason`, item.resolution_reason);
    ensureOptionalString(`contradictions[${i}].resolved_by`, item.resolved_by);
    ensureOptionalString(`contradictions[${i}].resolved_at`, item.resolved_at);
  }
}

export function validateProjects(items: unknown[]): void {
  for (const [i, item] of ensureArray("projects", items).entries()) {
    if (!isObject(item)) throw new Error(`projects[${i}] must be an object`);
    ensureString(`projects[${i}].project_id`, item.project_id);
    ensureString(`projects[${i}].company_id`, item.company_id);
    ensureString(`projects[${i}].status`, item.status);
    ensureString(`projects[${i}].lifecycle_state`, item.lifecycle_state);
    ensureString(`projects[${i}].memory_id`, item.memory_id);
    ensureString(`projects[${i}].schema_version`, item.schema_version);
  }
}

export function validateMemorySpaces(items: unknown[]): void {
  for (const [i, item] of ensureArray("memorySpaces", items).entries()) {
    if (!isObject(item)) throw new Error(`memorySpaces[${i}] must be an object`);
    ensureString(`memorySpaces[${i}].memory_id`, item.memory_id);
    ensureString(`memorySpaces[${i}].scope`, item.scope);
    ensureString(`memorySpaces[${i}].status`, item.status);
    ensureString(`memorySpaces[${i}].owner`, item.owner);
    ensureString(`memorySpaces[${i}].schema_version`, item.schema_version);
    ensureOptionalStringArray(`memorySpaces[${i}].readers`, item.readers);
    ensureOptionalStringArray(`memorySpaces[${i}].writers`, item.writers);
  }
}

export function validatePolicies(items: unknown[]): void {
  for (const [i, item] of ensureArray("policies", items).entries()) {
    if (!isObject(item)) throw new Error(`policies[${i}] must be an object`);
    ensureString(`policies[${i}].policy_id`, item.policy_id);
    ensureString(`policies[${i}].file`, item.file);
    ensureString(`policies[${i}].status`, item.status);
    ensureString(`policies[${i}].schema_version`, item.schema_version);
  }
}

export function validateAgents(items: unknown[]): void {
  for (const [i, item] of ensureArray("agents", items).entries()) {
    if (!isObject(item)) throw new Error(`agents[${i}] must be an object`);
    ensureString(`agents[${i}].agent_id`, item.agent_id);
    ensureString(`agents[${i}].display_name`, item.display_name);
    ensureString(`agents[${i}].status`, item.status);
    ensureString(`agents[${i}].private_memory_id`, item.private_memory_id);
    ensureString(`agents[${i}].experience_file`, item.experience_file);
    ensureString(`agents[${i}].lifecycle_state`, item.lifecycle_state);
    ensureString(`agents[${i}].specialization`, item.specialization);
    ensureString(`agents[${i}].schema_version`, item.schema_version);
    ensureOptionalStringArray(`agents[${i}].assigned_projects`, item.assigned_projects);
  }
}

export function validateCompanies(items: unknown[]): void {
  for (const [i, item] of ensureArray("companies", items).entries()) {
    if (!isObject(item)) throw new Error(`companies[${i}] must be an object`);
    ensureString(`companies[${i}].company_id`, item.company_id);
    ensureString(`companies[${i}].name`, item.name);
    ensureString(`companies[${i}].status`, item.status);
    ensureString(`companies[${i}].memory_id`, item.memory_id);
    ensureString(`companies[${i}].schema_version`, item.schema_version);
    ensureOptionalStringArray(`companies[${i}].projects`, item.projects);
  }
}
