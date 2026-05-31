"""End-to-end engine behaviour with the deterministic MockBrain (no creds).
Validates that the 3 ZOPA scenarios produce the expected outcomes."""

from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from app.brains import MockBrain
from app.graph import build_graph
from app.scenarios import SCENARIOS, make_initial_state


def _run(name: str):
    graph = build_graph(MockBrain(), checkpointer=MemorySaver())
    cfg = {"configurable": {"thread_id": f"test-{name}"}, "recursion_limit": 60}
    res = graph.invoke(make_initial_state(SCENARIOS[name], name), cfg)
    while "__interrupt__" in res:
        intr = res["__interrupt__"][0].value
        decision = {"decision": "approve"} if intr.get("type") == "approval" else {"decision": "reject"}
        res = graph.invoke(Command(resume=decision), cfg)
    return res


def test_cooperative_reaches_deal_within_corridor():
    res = _run("cooperative")
    sc = SCENARIOS["cooperative"]
    assert res["status"] == "deal"
    assert sc.vendor.floor_price <= res["result"]["price"] <= sc.user.max_price


def test_aggressive_deal_within_narrow_corridor():
    res = _run("aggressive")
    sc = SCENARIOS["aggressive"]
    assert res["status"] == "deal"
    assert sc.vendor.floor_price <= res["result"]["price"] <= sc.user.max_price


def test_deadlock_escalates_and_walks_away():
    # no ZOPA -> escalation -> (auto reject) -> walked_away; never a bogus deal
    res = _run("deadlock")
    assert res["status"] == "walked_away"


def _drive_with(name: str, decider):
    """Drive a scenario, resolving each interrupt via decider(interrupt_value)->decision dict."""
    graph = build_graph(MockBrain(), checkpointer=MemorySaver())
    cfg = {"configurable": {"thread_id": f"hitl-{name}-{id(decider)}"}, "recursion_limit": 80}
    res = graph.invoke(make_initial_state(SCENARIOS[name], name), cfg)
    while "__interrupt__" in res:
        res = graph.invoke(Command(resume=decider(res["__interrupt__"][0].value)), cfg)
    return res


def test_escalation_raise_limit_continues_and_can_deal():
    # Regression: human_decision must be a real state channel. Raising the budget past the
    # vendor floor creates a ZOPA -> negotiation must CONTINUE (not silently walk away).
    sc = SCENARIOS["deadlock"]  # floor 920jt > budget 880jt (no ZOPA)
    new_budget = sc.vendor.floor_price + 20_000_000  # now ZOPA exists

    def decider(intr):
        if intr.get("type") == "escalation":
            return {"decision": "raise_limit", "new_max_price": new_budget}
        return {"decision": "approve"}

    res = _drive_with("deadlock", decider)
    assert res["status"] == "deal"
    assert res["result"]["price"] <= new_budget


def test_escalation_reject_walks_away():
    res = _drive_with("deadlock", lambda intr: {"decision": "reject"})
    assert res["status"] == "walked_away"


def test_approval_reject_is_honored():
    # Regression: rejecting at approval must walk away (not default-approve into a deal).
    res = _drive_with("cooperative", lambda intr: {"decision": "reject"})
    assert res["status"] == "walked_away"


def test_escalation_lower_floor_continues_and_can_deal():
    # Seller-side concession: lowering the vendor floor below the buyer budget creates a ZOPA.
    sc = SCENARIOS["deadlock"]  # floor 920jt > budget 880jt (no ZOPA)
    new_floor = sc.user.max_price - 20_000_000  # floor now below budget -> ZOPA exists

    def decider(intr):
        if intr.get("type") == "escalation":
            return {"decision": "lower_floor", "new_floor_price": new_floor}
        return {"decision": "approve"}

    res = _drive_with("deadlock", decider)
    assert res["status"] == "deal"
    assert res["result"]["price"] >= new_floor
