import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type { HostPluginDescriptor } from "../interfaces";
import type { PluginEntryOptions } from "./plugin-entry";

export interface OpenClawPluginManifest {
  schemaVersion: string;
  id: string;
  displayName: string;
  version: string;
  entry: string;
  factory: string;
  protocolVersion: string;
  capabilities: {
    supportedHooks: string[];
    responseEnvelopes: string[];
    features: string[];
  };
}

export interface LoadedHostPlugin {
  manifest: OpenClawPluginManifest;
  descriptor: HostPluginDescriptor;
}

export async function loadHostPluginFromManifest(
  manifestPath: string,
  options: PluginEntryOptions = {},
): Promise<LoadedHostPlugin> {
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as OpenClawPluginManifest;

  if (manifest.schemaVersion !== "openclaw.plugin-manifest.v1") {
    throw new Error(`Unsupported plugin manifest schema: ${manifest.schemaVersion}`);
  }

  const entryPath = manifest.entry.startsWith("/")
    ? manifest.entry
    : manifest.entry.startsWith("plugin/")
      ? `/root/.openclaw/workspace/${manifest.entry}`
      : `${manifestPath.split("/").slice(0, -1).join("/")}/${manifest.entry.replace(/^\.\//, "")}`;
  const mod = await import(pathToFileURL(entryPath).href);
  const factory = mod[manifest.factory];

  if (typeof factory !== "function") {
    throw new Error(`Plugin factory not found: ${manifest.factory} in ${entryPath}`);
  }

  const descriptor = await factory({
    ...options,
    hostPlugin: {
      id: manifest.id,
      displayName: manifest.displayName,
      version: manifest.version,
      ...(options.hostPlugin ?? {}),
    },
  });

  return { manifest, descriptor };
}
