"""Deterministic negotiation gating (decision #5).

The LLM proposes a number; THIS module decides what is allowed and what happens.
No model call ever decides "deal", "deadlock", or crosses a corridor — pure math does.
"""

from __future__ import annotations

from typing import Literal, Optional

from .state import NegotiationState, Offer, UserGuardrail, VendorPrivate

CONVERGENCE_THRESHOLD = 0.05  # within 5% of the asking price => near deal
STAGNANT_LIMIT = 3  # consecutive non-moving rounds => deadlock
MOVE_EPS_REL = 0.005  # < 0.5% movement counts as "no movement"

Route = Literal["continue", "near_deal", "deadlock", "max_rounds"]


def zopa_exists(user: UserGuardrail, vendor: VendorPrivate) -> bool:
    """A Zone of Possible Agreement exists iff the user can afford the vendor's floor."""
    return user.max_price >= vendor.floor_price


def clamp_user_price(proposed: float, user: UserGuardrail, prev: Optional[float]) -> float:
    """User offers move UP toward the vendor over time, never above max_price,
    and never retreat below the user's previous offer."""
    p = min(proposed, user.max_price)
    if prev is not None:
        p = max(p, prev)  # monotonic up (no take-backs)
    return round(p, 2)


def clamp_vendor_price(proposed: float, vendor: VendorPrivate, prev: Optional[float]) -> float:
    """Vendor offers move DOWN toward the user over time, never below floor_price,
    and never climb above the vendor's previous offer."""
    p = max(proposed, vendor.floor_price)
    if prev is not None:
        p = min(p, prev)  # monotonic down
    return round(p, 2)


def relative_gap(vendor_price: float, user_price: float) -> float:
    """Gap between the two live offers, relative to the vendor's ask.
    <= 0 means the offers crossed (user willing to pay >= vendor asks)."""
    if vendor_price <= 0:
        return 1.0
    return (vendor_price - user_price) / vendor_price


def moved(prev: Optional[float], new: float) -> bool:
    if prev is None:
        return True
    denom = max(abs(prev), 1.0)
    return abs(new - prev) / denom >= MOVE_EPS_REL


def is_converged(vendor_price: float, user_price: float) -> bool:
    return user_price >= vendor_price or relative_gap(vendor_price, user_price) <= CONVERGENCE_THRESHOLD


def deal_price(vendor_price: float, user_price: float) -> float:
    """Settle point. If crossed, settle at the vendor's ask; else split the difference."""
    if user_price >= vendor_price:
        return round(vendor_price, 2)
    return round((vendor_price + user_price) / 2, 2)


def settlement(vendor_price: float, user_price: float, floor: float, max_price: float) -> float:
    """Final deal price, guaranteed within both corridors. Only meaningful when ZOPA holds."""
    raw = deal_price(vendor_price, user_price)
    return round(min(max(raw, floor), max_price), 2)


def route(state: NegotiationState) -> Route:
    """Decide what happens after a turn — the only place outcomes are decided.

    near_deal fires ONLY when a deal is actually feasible (ZOPA exists). Without ZOPA,
    'convergence' across the floor>budget gap is a false signal, so we escalate instead.
    """
    rn = state["round_no"]
    if rn >= state["max_rounds"]:
        return "max_rounds"

    user = state["user_private"]
    vendor = state["vendor_private"]
    vp = state.get("vendor_last_price")
    up = state.get("user_last_price")
    has_zopa = zopa_exists(user, vendor)
    both = vp is not None and up is not None

    if has_zopa and both and is_converged(vp, up):
        return "near_deal"

    # Infeasible corridor (no ZOPA) after a couple of probing rounds, or genuinely stuck.
    if (not has_zopa and rn >= 3) or state.get("stagnant_rounds", 0) >= STAGNANT_LIMIT:
        return "deadlock"

    return "continue"
