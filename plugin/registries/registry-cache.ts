import type { RegistryBundle } from "./registry-loader";
import { RegistryLoader } from "./registry-loader";
import type { RegistryHealth } from "./registry-health";

export class RegistryCache {
  private bundle: RegistryBundle | null = null;
  private loadedAt = 0;

  constructor(
    private readonly loader = new RegistryLoader(),
    private readonly ttlMs = 5000,
  ) {}

  async get(): Promise<RegistryBundle> {
    const now = Date.now();
    if (!this.bundle || now - this.loadedAt > this.ttlMs) {
      this.bundle = await this.loader.loadAll();
      this.loadedAt = now;
    }
    return this.bundle;
  }

  health(): RegistryHealth {
    return this.loader.health();
  }

  clear(): void {
    this.bundle = null;
    this.loadedAt = 0;
  }
}
