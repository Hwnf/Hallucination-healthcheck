# Hallucination Health Check Report

**Trace ID:** smoke1  
**Verdict:** UNSUPPORTED  
**Tier:** 3  
**Mode:** inline_soft_gate  
**Timestamp:** 2026-03-15 19:27 UTC  

---

## Executive Summary

This trace was marked **UNSUPPORTED** because the agent made a capability claim without corresponding tool evidence and included an additional unsupported factual claim identified by semantic analysis.

---

## Findings Overview

- Total Findings: 2
- Deterministic Findings: 1
- Semantic Findings: 1

---

## Deterministic Finding

**Category:** capability_overclaim  
**Turn:** 0  
**Claim:** "I searched"  
**Reason:** Capability claim detected with no tool calls at or before turn 0 to support it.

---

## Semantic Finding

**Category:** unsupported_claim  
**Turn:** 0  
**Claim ID:** c2  
**Reason:** LLM classified claim as unsupported.  
**Confidence:** 1.0

---

## Evidence Gap Analysis

The agent claimed to have performed a search action but no tool calls or outputs were present in the trace. Without runtime evidence, this constitutes a capability overclaim.

Additionally, a semantic claim extracted from the response lacked supporting evidence, resulting in a second unsupported classification.

---

## Conclusion

Because at least one unsupported claim exists, the overall verdict is **UNSUPPORTED**.

