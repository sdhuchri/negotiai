"""NegotiationGraph — the LangGraph state machine.

Turns alternate user <-> vendor. After each turn, DETERMINISTIC gating routes the flow
(continue / near_deal -> human approval / deadlock -> escalation / max_rounds -> walk away).
Built via a factory so the brain (Bedrock or Mock) can be injected for tests.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from . import gating
from .brains import Brain
from .state import NegotiationState, Offer


def build_graph(brain: Brain, checkpointer=None):
    def _turn(state: NegotiationState, role: str) -> dict:
        is_vendor = role == "vendor"
        private = state["vendor_private"] if is_vendor else state["user_private"]
        own_last = state.get("vendor_last_price") if is_vendor else state.get("user_last_price")
        round_no = state["round_no"] + 1

        move = brain.move(
            role=role,
            private=private,
            current_offer=state["current_offer"],
            current_actor=state["current_actor"],
            own_last_price=own_last,
            transcript=state["transcript"],
            round_no=round_no,
            max_rounds=state["max_rounds"],
        )

        if is_vendor:
            price = gating.clamp_vendor_price(move.proposed_price, private, own_last)
        else:
            price = gating.clamp_user_price(move.proposed_price, private, own_last)

        did_move = gating.moved(own_last, price)
        entry = {
            "round_no": round_no,
            "actor": role,
            "public_message": move.public_message,
            "internal_reasoning": move.internal_reasoning,
            "price": price,
            "lead_time": move.proposed_lead_time,
            "action": move.action,
        }
        updates: dict = {
            "round_no": round_no,
            "current_offer": Offer(price=price, lead_time_days=move.proposed_lead_time),
            "current_actor": role,
            "transcript": state["transcript"] + [entry],
            "stagnant_rounds": 0 if did_move else state.get("stagnant_rounds", 0) + 1,
        }
        updates["vendor_last_price" if is_vendor else "user_last_price"] = price
        return updates

    def user_turn(state: NegotiationState) -> dict:
        return _turn(state, "user")

    def vendor_turn(state: NegotiationState) -> dict:
        return _turn(state, "vendor")

    def human_gate(state: NegotiationState) -> dict:
        vp, up = state["vendor_last_price"], state["user_last_price"]
        price = gating.settlement(
            vp, up, state["vendor_private"].floor_price, state["user_private"].max_price
        )
        decision = interrupt(
            {
                "type": "approval",
                "deal_price": price,
                "vendor_price": vp,
                "user_price": up,
                "lead_time_days": state["current_offer"].lead_time_days,
                "round_no": state["round_no"],
            }
        ) or {}
        d = decision.get("decision", "approve")
        updates: dict = {"human_decision": {"decision": d}}
        if d == "adjust" and decision.get("new_max_price"):
            updates["user_private"] = state["user_private"].model_copy(
                update={"max_price": decision["new_max_price"]}
            )
            updates["stagnant_rounds"] = 0
            updates["max_rounds"] = state["max_rounds"] + 6  # human intervention earns more room
        return updates

    def escalate_gate(state: NegotiationState) -> dict:
        vp, up = state["vendor_last_price"], state["user_last_price"]
        decision = interrupt(
            {
                "type": "escalation",
                "vendor_price": vp,
                "user_price": up,
                "round_no": state["round_no"],
                "reason": "deadlock_or_out_of_corridor",
            }
        ) or {}
        d = decision.get("decision", "reject")
        updates: dict = {"human_decision": {"decision": d}}
        lead = state["current_offer"].lead_time_days
        rn = state["round_no"]

        def human_turn(actor: str, price: float, message: str) -> dict:
            # Surface the human's move as a visible negotiation turn (a chat bubble).
            return {
                "round_no": rn + 1,
                "actor": actor,
                "public_message": message,
                "internal_reasoning": "Intervensi manusia memecah kebuntuan.",
                "price": round(price, 2),
                "lead_time": lead,
                "action": "counter",
            }

        # Buyer raises budget -> becomes the buyer's new offer (shown as chat), vendor responds.
        if d == "raise_limit" and decision.get("new_max_price"):
            price = float(decision["new_max_price"])
            entry = human_turn(
                "user", price, f"Dari sisi pembeli, kami naikkan tawaran menjadi Rp{price:,.0f} untuk mencari titik temu."
            )
            updates["user_private"] = state["user_private"].model_copy(
                update={"max_price": max(state["user_private"].max_price, price)}
            )
            updates["user_last_price"] = price
            updates["current_offer"] = Offer(price=price, lead_time_days=lead)
            updates["current_actor"] = "user"
            updates["round_no"] = rn + 1
            updates["transcript"] = state["transcript"] + [entry]
            updates["stagnant_rounds"] = 0
            updates["max_rounds"] = state["max_rounds"] + 6
        # Seller lowers offer -> becomes the vendor's new offer (shown as chat), buyer responds.
        elif d == "lower_floor" and decision.get("new_floor_price"):
            price = float(decision["new_floor_price"])
            entry = human_turn(
                "vendor", price, f"Dari sisi penjual, kami turunkan penawaran menjadi Rp{price:,.0f}."
            )
            updates["vendor_private"] = state["vendor_private"].model_copy(
                update={"floor_price": min(state["vendor_private"].floor_price, price)}
            )
            updates["vendor_last_price"] = price
            updates["current_offer"] = Offer(price=price, lead_time_days=lead)
            updates["current_actor"] = "vendor"
            updates["round_no"] = rn + 1
            updates["transcript"] = state["transcript"] + [entry]
            updates["stagnant_rounds"] = 0
            updates["max_rounds"] = state["max_rounds"] + 6
        return updates

    def settle(state: NegotiationState) -> dict:
        price = gating.settlement(
            state["vendor_last_price"],
            state["user_last_price"],
            state["vendor_private"].floor_price,
            state["user_private"].max_price,
        )
        return {
            "status": "deal",
            "result": {"price": price, "lead_time_days": state["current_offer"].lead_time_days},
        }

    def give_up(state: NegotiationState) -> dict:
        return {"status": "walked_away", "result": {"reason": "no_agreement"}}

    # routing
    def route_after_turn(state: NegotiationState) -> str:
        return gating.route(state)

    def after_human(state: NegotiationState) -> str:
        d = state.get("human_decision", {}).get("decision", "approve")
        return {"approve": "settle", "reject": "give_up", "adjust": "vendor_turn"}.get(d, "settle")

    def after_escalate(state: NegotiationState) -> str:
        d = state.get("human_decision", {}).get("decision", "reject")
        if d == "raise_limit":
            return "vendor_turn"  # buyer moved -> vendor responds
        if d == "lower_floor":
            return "user_turn"  # seller moved -> buyer responds
        return "give_up"

    g = StateGraph(NegotiationState)
    g.add_node("user_turn", user_turn)
    g.add_node("vendor_turn", vendor_turn)
    g.add_node("human_gate", human_gate)
    g.add_node("escalate_gate", escalate_gate)
    g.add_node("settle", settle)
    g.add_node("give_up", give_up)

    g.add_edge(START, "user_turn")
    _turn_routes_user = {
        "continue": "vendor_turn",
        "near_deal": "human_gate",
        "deadlock": "escalate_gate",
        "max_rounds": "give_up",
    }
    _turn_routes_vendor = {**_turn_routes_user, "continue": "user_turn"}
    g.add_conditional_edges("user_turn", route_after_turn, _turn_routes_user)
    g.add_conditional_edges("vendor_turn", route_after_turn, _turn_routes_vendor)
    g.add_conditional_edges("human_gate", after_human, {
        "settle": "settle", "give_up": "give_up", "vendor_turn": "vendor_turn",
    })
    g.add_conditional_edges("escalate_gate", after_escalate, {
        "vendor_turn": "vendor_turn", "user_turn": "user_turn", "give_up": "give_up",
    })
    g.add_edge("settle", END)
    g.add_edge("give_up", END)

    return g.compile(checkpointer=checkpointer)
