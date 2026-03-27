# Smoke Test Workflow

This directory contains focused smoke tests for the Blueprint v2 plugin scaffold.

## Individual smoke tests
- `smoke.ts` — base runtime path
- `acl-smoke.ts` — ACL baseline behavior
- `acl-precedence-smoke.ts` — deny beats allow
- `acl-policy-fallback-smoke.ts` — registry-backed owner/reader/default-policy fallback behavior
- `adapter-smoke.ts` — OpenClaw + Paperclip enrichment
- `hook-adapter-smoke.ts` — hook path through adapters
- `paperclip-client-smoke.ts` — registry-backed Paperclip client works now and API mode returns structured HTTP failure behavior
- `paperclip-api-smoke.ts` — API-backed Paperclip client performs a real request/normalization path against a fake fetch endpoint
- `paperclip-fallback-smoke.ts` — API-mode Paperclip adapter falls back to registry state and caches resolved state when live resolution fails
- `paperclip-provenance-smoke.ts` — enriched context and adapter status expose whether Paperclip data came from api, registry-fallback, or cache
- `paperclip-runtime-signal-smoke.ts` — pre/post-turn outputs carry Paperclip provenance so hosts/operators can tell how context was sourced
- `paperclip-source-policy-smoke.ts` — explicit source-of-truth policy distinguishes api-preferred fallback behavior from api-only fail-closed behavior
- `paperclip-enforcement-smoke.ts` — runtime hooks fail closed when Paperclip source-of-truth is `api-only` and live Paperclip is degraded, with degraded provenance preserved through the adapter boundary
- `plugin-runtime-smoke.ts` — composed plugin runtime/factory boundary exercises pre-turn, post-turn, and health from one host-facing object
- `host-plugin-smoke.ts` — host/plugin registration descriptor exposes a stable runtime + hook contract for integration
- `host-negotiation-smoke.ts` — host expectation checks return explicit negotiation success/failure results for protocol/features/envelopes
- `host-negotiation-enforce-smoke.ts` — host descriptor creation can fail-open or fail-closed based on negotiation policy
- `host-envelope-smoke.ts` — host event envelopes and adapter mapping helpers normalize explicit pre/post-turn lifecycle contracts
- `host-lifecycle-smoke.ts` — host-facing lifecycle executor handles pre-turn, post-turn, and health events through one descriptor surface
- `host-loaded-execution-smoke.ts` — a manifest-loaded descriptor actually executes preTurn/postTurn/health through the host lifecycle surface
- `host-loaded-degraded-execution-smoke.ts` — a manifest-loaded descriptor preserves host-visible degraded Paperclip semantics and fail-closed behavior
- `host-loaded-controller-degraded-smoke.ts` — a manifest-loaded descriptor, degraded registration state, and host execution policy all compose correctly in one end-to-end path
- `host-loaded-controller-override-degraded-smoke.ts` — host override can allow degraded postTurn while the manifest-loaded runtime still surfaces degraded Paperclip semantics
- `host-response-envelope-smoke.ts` — host lifecycle executor returns standardized response envelopes with plugin/hook/event metadata plus top-level provenance
- `host-streaming-smoke.ts` — host lifecycle executor can expose chunked pre-turn responses for retrieval-heavy contexts
- `host-error-envelope-smoke.ts` — host lifecycle executor wraps thrown hook failures into standardized host error responses
- `host-registry-persistence-smoke.ts` — host registration/control state can be exported to disk and restored without losing lifecycle state

## Contract docs
- `../HOST_PLUGIN_CONTRACT.md` — host registration, capability metadata, envelopes, lifecycle execution, provenance, and response contract
- `../OPENCLAW_HOST_INTEGRATION.md` — expected host-side loading, registration, invocation, and trust-handling flow
- `../host-registration-manifest.example.json` — concrete example registration manifest a host could inspect/load
- `runtime-lifecycle-routing-smoke.ts` — archived lifecycle changes retrieval routing and canonical cold-storage IDs
- `preturn-sensitive-audit-smoke.ts` — sensitive/archive pre-turn retrieval is surfaced and audited
- `write-gate-smoke.ts` — write hygiene checks
- `lifecycle-write-gate-smoke.ts` — closeout/archive state blocks normal project writes until restore-style flow
- `metadata-builder-smoke.ts` — scope/lifecycle-aware metadata defaults
- `registry-validation-smoke.ts` — registry writer rejects malformed state instead of silently persisting it
- `registry-atomic-write-smoke.ts` — registry writer uses an atomic temp-write/rename seam so failed writes do not clobber the existing registry file
- `registry-schema-compat-smoke.ts` — loader surfaces unsupported registry item schema versions as degraded health instead of silently accepting them
- `registry-bundle-snapshot-smoke.ts` — registry bundles can be exported/imported through a top-level snapshot contract with schema metadata
- `registry-bundle-apply-smoke.ts` — selected writable registries can be restored from a bundle snapshot through the validated apply seam
- `registry-core-bundle-apply-smoke.ts` — core registries (`projects`, `memorySpaces`, `policies`) can also be restored through the validated bundle-apply path
- `registry-agent-company-apply-smoke.ts` — `agents` and `companies` can also be restored through the validated bundle-apply path
- `registry-bundle-rollback-smoke.ts` — dependency-ordered snapshot apply rolls back already-touched registries when a later registry write fails
- `registry-bundle-preflight-smoke.ts` — unsafe snapshot apply sets are rejected before any writes when required dependencies are missing
- `registry-bundle-audit-smoke.ts` — snapshot apply attempts emit durable audit events for preflight failure and lifecycle outcomes
- `registry-apply-report-smoke.ts` — recent/latest snapshot apply attempts can be summarized through the operator-facing report reader, correlated by applyAttemptId, and exposed with merged status/duration/event history
- `registry-loader-health-smoke.ts` — loader surfaces malformed registry state as health issues instead of silently treating it as normal
- `runtime-registry-health-smoke.ts` — pre/post-turn and ACL reasoning surface degraded registry health during real decision paths
- `degraded-fail-closed-smoke.ts` — degraded registry state forces sensitive/archive paths into fail-closed behavior
- `degraded-write-fail-closed-smoke.ts` — degraded registry state fail-closes sensitive mutation paths in post-turn runtime flow
- `manager-registry-guard-smoke.ts` — promotion/contradiction/closeout/restore manager mutations fail closed when dependent registries are degraded
- `contradiction-registry-guard-smoke.ts` — contradiction recording returns blocked/disputed state when contradictions registry is degraded
- `archive-registry-guard-smoke.ts` — archive mutation is blocked when archive-dependent registries are degraded
- `promotion-smoke.ts` — promotion validation
- `postturn-metadata-smoke.ts` — post-turn metadata shape + write-gate denial auditing
- `promotion-write-smoke.ts` — approved promotion creates promoted memory object
- `archive-smoke.ts` — archive manifest persistence
- `archive-access-smoke.ts` — archive gating semantics
- `closeout-smoke.ts` — lifecycle closeout path
- `lifecycle-audit-smoke.ts` — closeout/restore audit trail + canonical archive entry behavior
- `contradiction-smoke.ts` — contradiction recording/suppression
- `contradiction-review-smoke.ts` — contradictions can be queued for review and later resolved explicitly without suppressing candidates too early
- `contradiction-report-smoke.ts` — contradiction report reader surfaces open review queue, resolved sets, and summary counts correctly
- `multi-agent-closeout-smoke.ts` — more realistic lifecycle scenario

## Aggregated runner
- `run-all-smokes.ts`

## Run all local smoke tests
```bash
npx --yes tsx plugin/tests/run-all-smokes.ts
```

## Run live Supermemory tests
These require the env file or exported env vars:
```bash
set -a; source /root/.openclaw/workspace/.env.supermemory; set +a
```

Then run as needed:
```bash
npx --yes tsx plugin/tests/supermemory-real-smoke.ts
npx --yes tsx plugin/tests/supermemory-metadata-roundtrip.ts
npx --yes tsx plugin/tests/supermemory-scope-smoke.ts
npx --yes tsx plugin/tests/supermemory-conversation-smoke.ts
npx --yes tsx plugin/tests/supermemory-mismatch-audit.ts
```

## Purpose
The goal is repeatability: validate the scaffold quickly, then tighten weak spots revealed by the suite.
