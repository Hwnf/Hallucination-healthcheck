# Experience: agent_orchestrator

## Durable Lessons
- lesson: Keep shared memory highly curated.
  context: Multi-agent systems degrade when shared memory becomes noisy.
  signal: Duplicate, low-value, or stale updates begin accumulating.
  action: Restrict promotions, archive aggressively, and preserve only durable lessons.

## Bottlenecks Seen Repeatedly
- vague handoffs
- memory pollution
- unclear scope boundaries

## What Works
- layered memory
- orchestrator-controlled promotion
- project closeout with experience distillation

## What Fails
- flat shared memory
- unrestricted writing
- carrying dead project context forward

## Promotion Candidates
- reusable multi-agent governance patterns
