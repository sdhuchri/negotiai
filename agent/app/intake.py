"""Intake analysis (step 2): free-form text/file -> structured negotiation params.

Per-side analysis preserves asymmetry: user text is analyzed only into the user's
guardrail; vendor text only into the vendor's offer + secret floor. The two never mix.

BedrockAnalyzer = real LLM (default). MockAnalyzer = regex heuristic (no creds, for tests).
"""

from __future__ import annotations

import os
import re
from typing import Optional, Protocol

from pydantic import BaseModel, Field

from .state import Offer, UserGuardrail, VendorPrivate


class UserIntake(BaseModel):
    max_price: float = Field(description="Budget maksimal user (angka rupiah).")
    target_price: Optional[float] = Field(default=None, description="Target harga ideal user.")
    max_lead_time_days: int = Field(default=60)
    priority: str = Field(default="price", description="price|lead_time|warranty|payment_terms")
    payment_terms_pref: Optional[str] = None


class VendorIntake(BaseModel):
    asking_price: float = Field(description="Harga penawaran publik vendor (angka rupiah).")
    floor_price: float = Field(description="Harga pokok/floor RAHASIA vendor (tak boleh di bawah ini).")
    target_margin: Optional[float] = None
    lead_time_days: int = Field(default=30)
    min_lead_time_days: int = Field(default=7)
    warranty: Optional[str] = None
    payment_terms: Optional[str] = None


class Analyzer(Protocol):
    def analyze_user(self, text: str) -> UserGuardrail: ...
    def analyze_vendor(self, text: str) -> tuple[VendorPrivate, Offer]: ...


# ---------- helpers ----------

_UNIT = {
    "jt": 1_000_000, "juta": 1_000_000,
    "m": 1_000_000_000, "miliar": 1_000_000_000, "milyar": 1_000_000_000,
    "rb": 1_000, "ribu": 1_000,
    "k": 1_000,
}
_AMOUNT_RE = re.compile(r"(\d[\d.,]*)\s*(juta|miliar|milyar|jt|rb|ribu|m|k)?", re.IGNORECASE)


def parse_amounts(text: str) -> list[float]:
    out: list[float] = []
    for m in _AMOUNT_RE.finditer(text or ""):
        raw, unit = m.group(1), (m.group(2) or "").lower()
        num = raw.replace(".", "").replace(",", "")
        if not num.isdigit():
            continue
        val = float(num)
        if unit:
            val *= _UNIT.get(unit, 1)
        elif val < 100_000:
            # bare small number with no unit is unlikely to be a rupiah price; skip
            continue
        out.append(val)
    return out


def parse_days(text: str) -> Optional[int]:
    m = re.search(r"(\d+)\s*hari", text or "", re.IGNORECASE)
    return int(m.group(1)) if m else None


# ---------- Mock (regex) ----------

class MockAnalyzer:
    def analyze_user(self, text: str) -> UserGuardrail:
        amts = sorted(parse_amounts(text))
        max_price = amts[-1] if amts else 1_000_000_000
        target = amts[0] if len(amts) >= 2 else round(max_price * 0.88)
        days = parse_days(text) or 60
        return UserGuardrail(
            max_price=max_price, target_price=target, max_lead_time_days=days, priority="price"
        )

    def analyze_vendor(self, text: str) -> tuple[VendorPrivate, Offer]:
        amts = sorted(parse_amounts(text))
        asking = amts[-1] if amts else 1_000_000_000
        floor = amts[0] if len(amts) >= 2 else round(asking * 0.85)
        days = parse_days(text) or 30
        return (
            VendorPrivate(floor_price=floor, target_margin=None, min_lead_time_days=7),
            Offer(price=asking, lead_time_days=days),
        )


# ---------- Bedrock (LLM) ----------

_USER_SYS = """Ekstrak parameter negosiasi PEMBELI dari teks bebas berikut menjadi struktur.
Tebak angka yang masuk akal jika implisit. max_price = batas atas budget. Semua angka rupiah penuh."""

_VENDOR_SYS = """Ekstrak parameter negosiasi PENJUAL dari teks bebas berikut menjadi struktur.
asking_price = harga penawaran yang dipublikasikan. floor_price = batas bawah rahasia (harga pokok);
jika tidak disebut, perkirakan ~85% dari asking_price. Semua angka rupiah penuh."""

_USER_FORMAT = (
    'Balas HANYA satu objek JSON: {"max_price": number, "target_price": number|null, '
    '"max_lead_time_days": integer, "priority": "price"|"lead_time"|"warranty"|"payment_terms", '
    '"payment_terms_pref": string|null}.'
)
_VENDOR_FORMAT = (
    'Balas HANYA satu objek JSON: {"asking_price": number, "floor_price": number, '
    '"target_margin": number|null, "lead_time_days": integer, "min_lead_time_days": integer, '
    '"warranty": string|null, "payment_terms": string|null}.'
)


class BedrockAnalyzer:
    def __init__(self) -> None:
        from langchain_aws import ChatBedrockConverse

        model = os.environ.get("BEDROCK_MODEL_ID", "apac.anthropic.claude-sonnet-4-20250514-v1:0")
        region = os.environ.get("AWS_REGION", "ap-southeast-3")
        self._llm = ChatBedrockConverse(model=model, region_name=region, temperature=0, max_tokens=700)

    def analyze_user(self, text: str) -> UserGuardrail:
        from langchain_core.messages import HumanMessage, SystemMessage

        from .llm_json import invoke_structured

        r = invoke_structured(
            self._llm,
            [SystemMessage(content=_USER_SYS), HumanMessage(content=(text or "") + "\n\n" + _USER_FORMAT)],
            UserIntake,
        )
        return UserGuardrail(
            max_price=r.max_price,
            target_price=r.target_price,
            max_lead_time_days=r.max_lead_time_days,
            priority=r.priority if r.priority in ("price", "lead_time", "warranty", "payment_terms") else "price",
            payment_terms_pref=r.payment_terms_pref,
        )

    def analyze_vendor(self, text: str) -> tuple[VendorPrivate, Offer]:
        from langchain_core.messages import HumanMessage, SystemMessage

        from .llm_json import invoke_structured

        r = invoke_structured(
            self._llm,
            [SystemMessage(content=_VENDOR_SYS), HumanMessage(content=(text or "") + "\n\n" + _VENDOR_FORMAT)],
            VendorIntake,
        )
        return (
            VendorPrivate(
                floor_price=r.floor_price, target_margin=r.target_margin, min_lead_time_days=r.min_lead_time_days
            ),
            Offer(price=r.asking_price, lead_time_days=r.lead_time_days),
        )


def get_analyzer() -> Analyzer:
    kind = os.environ.get("NEGOTIAI_BRAIN", "bedrock").lower()
    return MockAnalyzer() if kind == "mock" else BedrockAnalyzer()
