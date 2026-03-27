import { execSync } from "node:child_process";

const commands = [
  ["smoke", "npx --yes tsx plugin/tests/smoke.ts"],
  ["acl", "npx --yes tsx plugin/tests/acl-smoke.ts"],
  ["acl-precedence", "npx --yes tsx plugin/tests/acl-precedence-smoke.ts"],
  ["acl-policy-fallback", "npx --yes tsx plugin/tests/acl-policy-fallback-smoke.ts"],
  ["adapters", "npx --yes tsx plugin/tests/adapter-smoke.ts"],
  ["paperclip-client", "npx --yes tsx plugin/tests/paperclip-client-smoke.ts"],
  ["paperclip-api", "npx --yes tsx plugin/tests/paperclip-api-smoke.ts"],
  ["paperclip-fallback", "npx --yes tsx plugin/tests/paperclip-fallback-smoke.ts"],
  ["paperclip-provenance", "npx --yes tsx plugin/tests/paperclip-provenance-smoke.ts"],
  ["paperclip-runtime-signal", "npx --yes tsx plugin/tests/paperclip-runtime-signal-smoke.ts"],
  ["paperclip-source-policy", "npx --yes tsx plugin/tests/paperclip-source-policy-smoke.ts"],
  ["paperclip-enforcement", "npx --yes tsx plugin/tests/paperclip-enforcement-smoke.ts"],
  ["hook-adapters", "npx --yes tsx plugin/tests/hook-adapter-smoke.ts"],
  ["plugin-runtime", "npx --yes tsx plugin/tests/plugin-runtime-smoke.ts"],
  ["host-plugin", "npx --yes tsx plugin/tests/host-plugin-smoke.ts"],
  ["host-negotiation", "npx --yes tsx plugin/tests/host-negotiation-smoke.ts"],
  ["host-negotiation-enforce", "npx --yes tsx plugin/tests/host-negotiation-enforce-smoke.ts"],
  ["host-envelope", "npx --yes tsx plugin/tests/host-envelope-smoke.ts"],
  ["host-lifecycle", "npx --yes tsx plugin/tests/host-lifecycle-smoke.ts"],
  ["host-response-envelope", "npx --yes tsx plugin/tests/host-response-envelope-smoke.ts"],
  ["host-streaming", "npx --yes tsx plugin/tests/host-streaming-smoke.ts"],
  ["host-manifest", "npx --yes tsx plugin/tests/host-manifest-smoke.ts"],
  ["host-loader", "npx --yes tsx plugin/tests/host-loader-smoke.ts"],
  ["host-loaded-execution", "npx --yes tsx plugin/tests/host-loaded-execution-smoke.ts"],
  ["host-loaded-degraded-execution", "npx --yes tsx plugin/tests/host-loaded-degraded-execution-smoke.ts"],
  ["host-loaded-controller-degraded", "npx --yes tsx plugin/tests/host-loaded-controller-degraded-smoke.ts"],
  ["host-loaded-controller-override-degraded", "npx --yes tsx plugin/tests/host-loaded-controller-override-degraded-smoke.ts"],
  ["host-registration-state", "npx --yes tsx plugin/tests/host-registration-state-smoke.ts"],
  ["host-registry-persistence", "npx --yes tsx plugin/tests/host-registry-persistence-smoke.ts"],
  ["host-reconcile", "npx --yes tsx plugin/tests/host-reconcile-smoke.ts"],
  ["host-disable-enable", "npx --yes tsx plugin/tests/host-disable-enable-smoke.ts"],
  ["host-action-policy", "npx --yes tsx plugin/tests/host-action-policy-smoke.ts"],
  ["host-controller", "npx --yes tsx plugin/tests/host-controller-smoke.ts"],
  ["host-policy-override", "npx --yes tsx plugin/tests/host-policy-override-smoke.ts"],
  ["host-error-envelope", "npx --yes tsx plugin/tests/host-error-envelope-smoke.ts"],
  ["runtime-lifecycle-routing", "npx --yes tsx plugin/tests/runtime-lifecycle-routing-smoke.ts"],
  ["preturn-sensitive-audit", "npx --yes tsx plugin/tests/preturn-sensitive-audit-smoke.ts"],
  ["write-gate", "npx --yes tsx plugin/tests/write-gate-smoke.ts"],
  ["lifecycle-write-gate", "npx --yes tsx plugin/tests/lifecycle-write-gate-smoke.ts"],
  ["metadata-builder", "npx --yes tsx plugin/tests/metadata-builder-smoke.ts"],
  ["registry-validation", "npx --yes tsx plugin/tests/registry-validation-smoke.ts"],
  ["registry-atomic-write", "npx --yes tsx plugin/tests/registry-atomic-write-smoke.ts"],
  ["registry-schema-compat", "npx --yes tsx plugin/tests/registry-schema-compat-smoke.ts"],
  ["registry-bundle-snapshot", "npx --yes tsx plugin/tests/registry-bundle-snapshot-smoke.ts"],
  ["registry-bundle-apply", "npx --yes tsx plugin/tests/registry-bundle-apply-smoke.ts"],
  ["registry-core-bundle-apply", "npx --yes tsx plugin/tests/registry-core-bundle-apply-smoke.ts"],
  ["registry-agent-company-apply", "npx --yes tsx plugin/tests/registry-agent-company-apply-smoke.ts"],
  ["registry-bundle-rollback", "npx --yes tsx plugin/tests/registry-bundle-rollback-smoke.ts"],
  ["registry-bundle-preflight", "npx --yes tsx plugin/tests/registry-bundle-preflight-smoke.ts"],
  ["registry-bundle-audit", "npx --yes tsx plugin/tests/registry-bundle-audit-smoke.ts"],
  ["registry-apply-report", "npx --yes tsx plugin/tests/registry-apply-report-smoke.ts"],
  ["registry-loader-health", "npx --yes tsx plugin/tests/registry-loader-health-smoke.ts"],
  ["runtime-registry-health", "npx --yes tsx plugin/tests/runtime-registry-health-smoke.ts"],
  ["degraded-fail-closed", "npx --yes tsx plugin/tests/degraded-fail-closed-smoke.ts"],
  ["degraded-write-fail-closed", "npx --yes tsx plugin/tests/degraded-write-fail-closed-smoke.ts"],
  ["manager-registry-guard", "npx --yes tsx plugin/tests/manager-registry-guard-smoke.ts"],
  ["contradiction-registry-guard", "npx --yes tsx plugin/tests/contradiction-registry-guard-smoke.ts"],
  ["archive-registry-guard", "npx --yes tsx plugin/tests/archive-registry-guard-smoke.ts"],
  ["promotion", "npx --yes tsx plugin/tests/promotion-smoke.ts"],
  ["postturn-metadata", "npx --yes tsx plugin/tests/postturn-metadata-smoke.ts"],
  ["promotion-write", "npx --yes tsx plugin/tests/promotion-write-smoke.ts"],
  ["archive", "npx --yes tsx plugin/tests/archive-smoke.ts"],
  ["archive-access", "npx --yes tsx plugin/tests/archive-access-smoke.ts"],
  ["closeout", "npx --yes tsx plugin/tests/closeout-smoke.ts"],
  ["lifecycle-audit", "npx --yes tsx plugin/tests/lifecycle-audit-smoke.ts"],
  ["contradiction", "npx --yes tsx plugin/tests/contradiction-smoke.ts"],
  ["contradiction-review", "npx --yes tsx plugin/tests/contradiction-review-smoke.ts"],
  ["contradiction-report", "npx --yes tsx plugin/tests/contradiction-report-smoke.ts"],
  ["multi-closeout", "npx --yes tsx plugin/tests/multi-agent-closeout-smoke.ts"],
];

const results: Array<{ name: string; ok: boolean; error?: string }> = [];

for (const [name, cmd] of commands) {
  try {
    execSync(cmd, { stdio: "pipe", cwd: "/root/.openclaw/workspace" });
    results.push({ name, ok: true });
  } catch (err: any) {
    results.push({
      name,
      ok: false,
      error: err?.stderr?.toString?.() || err?.message || String(err),
    });
  }
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
if (failed.length) process.exit(1);
