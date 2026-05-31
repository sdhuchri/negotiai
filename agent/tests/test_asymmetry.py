"""Information asymmetry must hold at the prompt level (decision #6):
a vendor's prompt must never contain the user's secret numbers, and vice versa."""

from app.prompts import build_messages
from app.state import Offer, UserGuardrail, VendorPrivate

# distinctive numbers unlikely to collide with anything else in the prompt
USER_SECRET = 888_111_222  # max_price
USER_TARGET = 777_333_444
VENDOR_SECRET = 555_666_777  # floor_price
VENDOR_MARGIN = 99_000_111

USER = UserGuardrail(max_price=USER_SECRET, target_price=USER_TARGET)
VENDOR = VendorPrivate(floor_price=VENDOR_SECRET, target_margin=VENDOR_MARGIN)
OFFER = Offer(price=900_000_000)


def _digits(msgs) -> str:
    return "".join(m["content"] for m in msgs).replace(",", "").replace(".", "")


def test_vendor_prompt_hides_user_secret():
    text = _digits(build_messages("vendor", VENDOR, OFFER, "vendor", [], 1, 8))
    assert str(USER_SECRET) not in text
    assert str(USER_TARGET) not in text
    assert str(VENDOR_SECRET) in text  # sanity: vendor DOES see its own floor


def test_user_prompt_hides_vendor_secret():
    text = _digits(build_messages("user", USER, OFFER, "vendor", [], 1, 8))
    assert str(VENDOR_SECRET) not in text
    assert str(VENDOR_MARGIN) not in text
    assert str(USER_SECRET) in text  # sanity: user DOES see its own budget
