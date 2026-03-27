# Supermemory Mismatch Audit Notes

Purpose: capture where Blueprint v2 expectations align cleanly with live Supermemory behavior and where plugin-side normalization remains necessary.

## Things to verify after live tests
- canonical key round-trip
- memory scope round-trip
- visibility round-trip
- company/project/user/session linkage round-trip
- status round-trip
- dedup key round-trip
- supersession lineage round-trip
- ranking hints (`retrievalPriority`, `qualityScore`) round-trip
- tag preservation

## Likely outcomes
### Matches
These fields are expected to survive cleanly if stored in metadata and returned in search results.

### Partial matches
Some fields may survive but with shape differences, nullability differences, or backend normalization.
These should be normalized in the plugin.

### Mismatches
If a field does not round-trip reliably, do not trust the backend alone for that behavior.
Enforce/reconstruct it in the plugin/runtime layer.

## Plugin response rules
- if a field round-trips reliably -> trust backend copy
- if a field is partial -> normalize in the client mapper
- if a field does not round-trip -> treat backend as storage only, and enforce behavior from policy/registry/runtime

## Most important principle
Blueprint v2 remains the canon.
If Supermemory behavior differs, the plugin should absorb the mismatch rather than silently changing the blueprint.
