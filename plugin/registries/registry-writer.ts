import {
  validatePromotions,
  validateArchives,
  validateExperienceIndex,
  validateContradictions,
  validateProjects,
  validateMemorySpaces,
  validatePolicies,
  validateAgents,
  validateCompanies,
} from "./registry-validation";
import { writeJsonAtomic, type AtomicFileFs } from "./atomic-file";

const ROOT = "/root/.openclaw/workspace/agents/registry";

export class RegistryWriter {
  constructor(private readonly fsImpl?: AtomicFileFs) {}

  async writePromotions(items: unknown[]): Promise<void> {
    validatePromotions(items);
    await writeJsonAtomic(`${ROOT}/promotions.json`, items, this.fsImpl);
  }

  async writeArchives(items: unknown[]): Promise<void> {
    validateArchives(items);
    await writeJsonAtomic(`${ROOT}/archives.json`, items, this.fsImpl);
  }

  async writeExperienceIndex(items: unknown[]): Promise<void> {
    validateExperienceIndex(items);
    await writeJsonAtomic(`${ROOT}/experience_index.json`, items, this.fsImpl);
  }

  async writeContradictions(items: unknown[]): Promise<void> {
    validateContradictions(items);
    await writeJsonAtomic(`${ROOT}/contradictions.json`, items, this.fsImpl);
  }

  async writeProjects(items: unknown[]): Promise<void> {
    validateProjects(items);
    await writeJsonAtomic(`${ROOT}/projects.json`, items, this.fsImpl);
  }

  async writeMemorySpaces(items: unknown[]): Promise<void> {
    validateMemorySpaces(items);
    await writeJsonAtomic(`${ROOT}/memory_spaces.json`, items, this.fsImpl);
  }

  async writePolicies(items: unknown[]): Promise<void> {
    validatePolicies(items);
    await writeJsonAtomic(`${ROOT}/policies.json`, items, this.fsImpl);
  }

  async writeAgents(items: unknown[]): Promise<void> {
    validateAgents(items);
    await writeJsonAtomic(`${ROOT}/agents.json`, items, this.fsImpl);
  }

  async writeCompanies(items: unknown[]): Promise<void> {
    validateCompanies(items);
    await writeJsonAtomic(`${ROOT}/companies.json`, items, this.fsImpl);
  }
}
