import sys
import asyncio
from pathlib import Path

sys.path.insert(0, "hhc")

from packages.parser.trace_loader import load_trace
from packages.adapters.gemini import create_gemini_adapter
from packages.adapters.base import build_call_a_input

TIMEOUT_SECONDS = 60  # increased for debug only

async def run_call_a(trace_path: str):
 trace = load_trace(Path(trace_path))
 adapter = create_gemini_adapter()

 assistant_msgs = trace.assistant_messages()
 if not assistant_msgs:
  print("No assistant messages.")
  return

 print(f"\n=== TRACE: {trace.trace_id} ===")

 for msg in assistant_msgs:
  print("\n--- Assistant Text ---")
  print(msg.content)

  input_a = build_call_a_input(
   answer_text=msg.content,
   context_text=trace.context_text(),
   turn_index=msg.turn_index,
  )

  try:
   result = await asyncio.wait_for(adapter.call(input_a), timeout=TIMEOUT_SECONDS)
  except asyncio.TimeoutError:
   print(f"\n--- Adapter Timeout after {TIMEOUT_SECONDS}s ---")
   continue

  print("\n--- Raw Gemini Output ---")
  print(result.raw_output)

  print("\n--- Parse Success ---")
  print(result.success)

  if result.success and result.parsed is not None:
   print("\n--- Parsed Claim Count ---")
   print(len(result.parsed))

   print("\n--- Parsed Claims ---")
   for claim in result.parsed:
    print({
     "claim_id": claim.claim_id,
     "claim_text": claim.claim_text,
     "claim_type": claim.claim_type,
    })

   print("\n--- Claim Types ---")
   print([claim.claim_type for claim in result.parsed])
  else:
   print("\n--- Parsing Failed or No Parsed Output ---")
   print(result.error)


if __name__ == "__main__":
 if len(sys.argv) != 2:
  print("Usage: python debug_call_a.py <trace_path>")
  sys.exit(1)

 asyncio.run(run_call_a(sys.argv[1]))
