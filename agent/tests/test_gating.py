from app import gating
from app.state import UserGuardrail, VendorPrivate


def _state(**kw):
    base = {
        "round_no": 1,
        "max_rounds": 8,
        "user_private": UserGuardrail(max_price=900, target_price=820),
        "vendor_private": VendorPrivate(floor_price=780),
        "vendor_last_price": 900,
        "user_last_price": 800,
        "stagnant_rounds": 0,
    }
    base.update(kw)
    return base


def test_zopa_exists():
    assert gating.zopa_exists(UserGuardrail(max_price=900), VendorPrivate(floor_price=780))
    assert not gating.zopa_exists(UserGuardrail(max_price=880), VendorPrivate(floor_price=920))


def test_clamp_vendor_never_below_floor_and_monotonic_down():
    v = VendorPrivate(floor_price=780)
    assert gating.clamp_vendor_price(700, v, prev=900) == 780  # not below floor
    assert gating.clamp_vendor_price(950, v, prev=900) == 900  # not above previous


def test_clamp_user_never_above_max_and_monotonic_up():
    u = UserGuardrail(max_price=900)
    assert gating.clamp_user_price(1000, u, prev=800) == 900  # not above budget
    assert gating.clamp_user_price(750, u, prev=800) == 800  # no take-backs


def test_convergence_and_crossing():
    assert gating.is_converged(800, 790)  # 1.25% gap
    assert not gating.is_converged(900, 700)  # 22% gap
    assert gating.is_converged(700, 800)  # crossed


def test_settlement_clamped_to_corridor():
    # midpoint would be 850; within [780, 900]
    assert gating.settlement(880, 820, floor=780, max_price=900) == 850
    # crossed -> vendor price, but never exceed budget
    assert gating.settlement(700, 800, floor=600, max_price=900) == 700


def test_route_near_deal_only_with_zopa():
    # ZOPA + converged -> near_deal
    assert gating.route(_state(vendor_last_price=805, user_last_price=800)) == "near_deal"
    # no ZOPA, even if numerically close, never near_deal
    s = _state(
        user_private=UserGuardrail(max_price=880),
        vendor_private=VendorPrivate(floor_price=920),
        vendor_last_price=925,
        user_last_price=879,
        round_no=3,
    )
    assert gating.route(s) == "deadlock"


def test_route_max_rounds():
    assert gating.route(_state(round_no=8)) == "max_rounds"
