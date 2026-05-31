"""Drives the negotiation graph and streams events to Go.

A single module-level graph + MemorySaver persists checkpoints across the run and a
later resume call (single-process MVP; PostgresSaver is the production target per
ARCHITECTURE #1). thread_id = negotiation_id.
"""

from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from .brains import get_brain
from .events import emit
from .state import NegotiationState, Offer, UserGuardrail, VendorPrivate

_SAVER = MemorySaver()
_GRAPH = None


def _graph():
    global _GRAPH
    if _GRAPH is None:
        from .graph import build_graph

        _GRAPH = build_graph(get_brain(), checkpointer=_SAVER)
    return _GRAPH


def _config(nid: str) -> dict:
    return {"configurable": {"thread_id": nid}, "recursion_limit": 80}


def _initial_state(
    nid: str, user: UserGuardrail, vendor: VendorPrivate, offer: Offer, max_rounds: int
) -> NegotiationState:
    return {
        "negotiation_id": nid,
        "round_no": 0,
        "max_rounds": max_rounds,
        "user_private": user,
        "vendor_private": vendor,
        "current_offer": offer,
        "current_actor": "vendor",
        "vendor_last_price": offer.price,
        "user_last_price": None,
        "transcript": [
            {
                "round_no": 0,
                "actor": "vendor",
                "public_message": f"Penawaran awal kami: {offer.price:,.0f}.",
                "internal_reasoning": "Opening offer.",
                "price": offer.price,
                "lead_time": offer.lead_time_days,
                "action": "counter",
            }
        ],
        "status": "negotiating",
        "stagnant_rounds": 0,
        "result": {},
    }


def _drive(nid: str, stream_input) -> None:
    g = _graph()
    cfg = _config(nid)
    terminal = False
    for chunk in g.stream(stream_input, cfg, stream_mode="updates"):
        if "__interrupt__" in chunk:
            intr = chunk["__interrupt__"][0].value
            emit({"negotiation_id": nid, "type": "interrupt", "interrupt": intr})
            return
        for node, upd in chunk.items():
            if not isinstance(upd, dict):
                continue
            # Any node that appended a transcript entry is a visible turn — including the
            # human intervention injected by escalate_gate/human_gate.
            if upd.get("transcript"):
                emit({"negotiation_id": nid, "type": "round", "round": upd["transcript"][-1]})
            if node in ("settle", "give_up"):
                terminal = True
                emit(
                    {
                        "negotiation_id": nid,
                        "type": "settled",
                        "result": {"status": upd.get("status"), **(upd.get("result") or {})},
                    }
                )
    # Fallback: some langgraph versions surface interrupts only via state.
    if not terminal:
        snap = g.get_state(cfg)
        pending = []
        for t in getattr(snap, "tasks", []) or []:
            pending += list(getattr(t, "interrupts", []) or [])
        if pending:
            emit({"negotiation_id": nid, "type": "interrupt", "interrupt": pending[0].value})


def run_negotiation(
    nid: str, user: UserGuardrail, vendor: VendorPrivate, offer: Offer, max_rounds: int = 8
) -> None:
    state = _initial_state(nid, user, vendor, offer, max_rounds)
    emit({"negotiation_id": nid, "type": "round", "round": state["transcript"][0]})
    _drive(nid, state)


def resume_negotiation(nid: str, decision: dict) -> None:
    _drive(nid, Command(resume=decision))
