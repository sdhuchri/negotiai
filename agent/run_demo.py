"""CLI: run a negotiation scenario standalone and print the transcript.

    python run_demo.py cooperative              # uses NEGOTIAI_BRAIN (default bedrock)
    NEGOTIAI_BRAIN=mock python run_demo.py all   # deterministic, no creds

Auto-resolves human interrupts: approval -> approve, escalation -> reject (walk away).
"""

from __future__ import annotations

import os
import sys

from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from app.brains import get_brain
from app.gating import zopa_exists
from app.graph import build_graph
from app.scenarios import SCENARIOS, make_initial_state


def auto_decision(intr: dict) -> dict:
    if intr.get("type") == "approval":
        return {"decision": "approve"}
    return {"decision": "reject"}  # escalation -> walk away (demonstrates walked_away)


def rupiah(n) -> str:
    return f"Rp{n:,.0f}" if isinstance(n, (int, float)) else str(n)


def run_one(name: str, brain) -> None:
    sc = SCENARIOS[name]
    print("\n" + "=" * 72)
    print(f"SKENARIO: {name.upper()} — {sc.description}")
    print(
        f"  vendor_ask={rupiah(sc.vendor_ask)} | floor={rupiah(sc.vendor.floor_price)} "
        f"| budget={rupiah(sc.user.max_price)} | target={rupiah(sc.user.target_price)}"
    )
    print(f"  ZOPA ada? {zopa_exists(sc.user, sc.vendor)}")
    print("=" * 72)

    graph = build_graph(brain, checkpointer=MemorySaver())
    config = {"configurable": {"thread_id": f"demo-{name}"}, "recursion_limit": 60}
    result = graph.invoke(make_initial_state(sc, name), config)

    while "__interrupt__" in result:
        intr = result["__interrupt__"][0].value
        decision = auto_decision(intr)
        kind = intr.get("type")
        if kind == "approval":
            print(f"\n  ⏸️  INTERRUPT (approval) @ {rupiah(intr.get('deal_price'))} → human: {decision['decision']}")
        else:
            print(f"\n  ⏸️  INTERRUPT (escalation): vendor {rupiah(intr.get('vendor_price'))} vs user {rupiah(intr.get('user_price'))} → human: {decision['decision']}")
        result = graph.invoke(Command(resume=decision), config)

    print("\n  Transcript:")
    for t in result["transcript"]:
        print(f"   [{t['round_no']:>2}] {t['actor']:<6} {rupiah(t['price']):>16}  — {t['public_message']}")
        if t["internal_reasoning"] and t["round_no"] > 0:
            print(f"        ↳ 💭 {t['internal_reasoning']}")

    status = result.get("status")
    res = result.get("result", {})
    icon = {"deal": "✅", "walked_away": "⚫"}.get(status, "•")
    print(f"\n  {icon} HASIL: {status}  {res}")


def main() -> None:
    arg = sys.argv[1] if len(sys.argv) > 1 else "all"
    brain = get_brain()
    print(f"Brain: {os.environ.get('NEGOTIAI_BRAIN', 'bedrock')}")
    names = list(SCENARIOS) if arg == "all" else [arg]
    for name in names:
        if name not in SCENARIOS:
            print(f"Skenario tidak dikenal: {name}. Pilihan: {', '.join(SCENARIOS)} | all")
            continue
        run_one(name, brain)


if __name__ == "__main__":
    main()
