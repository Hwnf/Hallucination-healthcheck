import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { HostPluginDescriptor } from "../interfaces";
import type { HostNegotiationResult } from "./host-negotiation";
import type { OpenClawPluginManifest } from "./host-loader";

export type HostPluginLifecycleState = "discovered" | "registered" | "degraded" | "rejected" | "disabled";

export interface HostPluginRecord {
  id: string;
  version: string;
  state: HostPluginLifecycleState;
  manifest: OpenClawPluginManifest;
  capabilities: HostPluginDescriptor["capabilities"];
  lastNegotiation?: HostNegotiationResult | null;
  lastHealth?: {
    ok: boolean;
    issues: Array<{ registry: string; path: string; severity: "warning" | "error"; message: string }>;
    loadedAt: string;
  } | null;
  updatedAt: string;
}

export interface HostRegistrySnapshot {
  schemaVersion: "host-plugin-registry.v1";
  exportedAt: string;
  records: HostPluginRecord[];
}

export class HostPluginRegistry {
  private records = new Map<string, HostPluginRecord>();

  list(): HostPluginRecord[] {
    return [...this.records.values()];
  }

  get(id: string): HostPluginRecord | null {
    return this.records.get(id) ?? null;
  }

  upsert(record: HostPluginRecord): HostPluginRecord {
    this.records.set(record.id, record);
    return record;
  }

  setState(id: string, state: HostPluginLifecycleState): HostPluginRecord | null {
    const current = this.records.get(id);
    if (!current) return null;
    const next = { ...current, state, updatedAt: new Date().toISOString() };
    this.records.set(id, next);
    return next;
  }

  disable(id: string): HostPluginRecord | null {
    return this.setState(id, "disabled");
  }

  enable(id: string): HostPluginRecord | null {
    const current = this.records.get(id);
    if (!current) return null;
    const nextState: HostPluginLifecycleState = !current.lastHealth?.ok
      ? "degraded"
      : current.lastNegotiation && !current.lastNegotiation.ok
        ? "rejected"
        : "registered";
    return this.setState(id, nextState);
  }

  exportSnapshot(): HostRegistrySnapshot {
    return {
      schemaVersion: "host-plugin-registry.v1",
      exportedAt: new Date().toISOString(),
      records: this.list(),
    };
  }

  importSnapshot(snapshot: HostRegistrySnapshot): HostPluginRecord[] {
    if (!snapshot || snapshot.schemaVersion !== "host-plugin-registry.v1") {
      throw new Error(`Unsupported host registry snapshot schema: ${snapshot?.schemaVersion ?? "unknown"}`);
    }

    this.records.clear();
    for (const record of snapshot.records ?? []) {
      this.records.set(record.id, record);
    }
    return this.list();
  }

  async saveToFile(path: string): Promise<HostRegistrySnapshot> {
    const snapshot = this.exportSnapshot();
    const dir = path.split("/").slice(0, -1).join("/");
    if (dir) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(path, JSON.stringify(snapshot, null, 2));
    return snapshot;
  }

  async loadFromFile(path: string): Promise<HostRegistrySnapshot> {
    const raw = await readFile(path, "utf8");
    const snapshot = JSON.parse(raw) as HostRegistrySnapshot;
    this.importSnapshot(snapshot);
    return snapshot;
  }

  static async fromFile(path: string): Promise<HostPluginRegistry> {
    const registry = new HostPluginRegistry();
    await registry.loadFromFile(path);
    return registry;
  }
}
