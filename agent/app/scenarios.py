"""Three seeded ZOPA scenarios (decision #7). The 3 outcomes from the PRD
(cooperative / aggressive / deadlock) emerge from the NUMBERS, not branching logic."""

from __future__ import annotations

from dataclasses import dataclass

from .state import NegotiationState, Offer, UserGuardrail, VendorPrivate

JT = 1_000_000  # juta rupiah


@dataclass
class Scenario:
    name: str
    description: str
    vendor_ask: float
    user: UserGuardrail
    vendor: VendorPrivate
    lead_time_days: int = 30
    max_rounds: int = 8


SCENARIOS: dict[str, Scenario] = {
    "cooperative": Scenario(
        name="cooperative",
        description="ZOPA lebar (floor 780jt << budget 900jt) → deal cepat.",
        vendor_ask=920 * JT,
        user=UserGuardrail(max_price=900 * JT, target_price=820 * JT, priority="price"),
        vendor=VendorPrivate(floor_price=780 * JT, target_margin=60 * JT),
    ),
    "aggressive": Scenario(
        name="aggressive",
        description="ZOPA tipis (floor 870jt vs budget 890jt) → tegang, deal di tepi.",
        vendor_ask=950 * JT,
        user=UserGuardrail(max_price=890 * JT, target_price=820 * JT, priority="price"),
        vendor=VendorPrivate(floor_price=870 * JT, target_margin=40 * JT),
    ),
    "deadlock": Scenario(
        name="deadlock",
        description="Tidak ada ZOPA (floor 920jt > budget 880jt) → eskalasi ke manusia.",
        vendor_ask=980 * JT,
        user=UserGuardrail(max_price=880 * JT, target_price=800 * JT, priority="price"),
        vendor=VendorPrivate(floor_price=920 * JT, target_margin=50 * JT),
    ),
}


def make_initial_state(sc: Scenario, negotiation_id: str = "demo") -> NegotiationState:
    return {
        "negotiation_id": negotiation_id,
        "round_no": 0,
        "max_rounds": sc.max_rounds,
        "user_private": sc.user,
        "vendor_private": sc.vendor,
        "current_offer": Offer(price=sc.vendor_ask, lead_time_days=sc.lead_time_days),
        "current_actor": "vendor",
        "vendor_last_price": sc.vendor_ask,
        "user_last_price": None,
        "transcript": [
            {
                "round_no": 0,
                "actor": "vendor",
                "public_message": f"Penawaran awal kami: {sc.vendor_ask:,.0f}.",
                "internal_reasoning": "Opening offer (asking price).",
                "price": sc.vendor_ask,
                "lead_time": sc.lead_time_days,
                "action": "counter",
            }
        ],
        "status": "negotiating",
        "stagnant_rounds": 0,
        "result": {},
    }
