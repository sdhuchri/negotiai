"""Agent "brains" — the pluggable layer that produces a move.

- BedrockBrain: the real LLM (AWS Bedrock / Claude Sonnet, Jakarta). DEFAULT.
- MockBrain: deterministic concession logic for unit tests — no API key, no tokens.

Either way the brain only PROPOSES; gating.py enforces corridors and decides outcomes.
"""

from __future__ import annotations

import os
from typing import Optional, Protocol

from .prompts import build_messages
from .state import AgentMove, Offer, TranscriptEntry, UserGuardrail, VendorPrivate


class Brain(Protocol):
    def move(
        self,
        *,
        role: str,
        private: UserGuardrail | VendorPrivate,
        current_offer: Offer,
        current_actor: str,
        own_last_price: Optional[float],
        transcript: list[TranscriptEntry],
        round_no: int,
        max_rounds: int,
    ) -> AgentMove: ...


class MockBrain:
    """Deterministic: each side concedes a fraction toward its own limit each turn.
    Always 'counter' — convergence/deal is decided by gating, not the brain."""

    def __init__(self, concession: float = 0.4) -> None:
        self.concession = concession

    def move(self, *, role, private, current_offer, current_actor, own_last_price, transcript, round_no, max_rounds):
        if role == "vendor":
            assert isinstance(private, VendorPrivate)
            last = own_last_price if own_last_price is not None else current_offer.price
            proposed = last - self.concession * (last - private.floor_price)
            msg = f"Kami tawarkan {proposed:,.0f}. Ini sudah kompetitif untuk kualitas ini."
            reason = f"Floor {private.floor_price:,.0f}; turun bertahap dari {last:,.0f}."
        else:
            assert isinstance(private, UserGuardrail)
            opening = private.target_price if private.target_price is not None else current_offer.price * 0.7
            last = own_last_price if own_last_price is not None else opening
            proposed = last + self.concession * (private.max_price - last)
            msg = f"Budget kami ketat, kami bisa di {proposed:,.0f}."
            reason = f"Budget {private.max_price:,.0f}; naik bertahap dari {last:,.0f}."
        return AgentMove(
            public_message=msg,
            internal_reasoning=reason,
            proposed_price=round(proposed, 2),
            proposed_lead_time=current_offer.lead_time_days,
            action="counter",
        )


_MOVE_FORMAT = (
    'Balas HANYA satu objek JSON (tanpa teks/penjelasan lain) dengan field persis: '
    '{"public_message": string, "internal_reasoning": string, '
    '"proposed_price": number, "proposed_lead_time": integer, '
    '"action": "counter" | "accept" | "walk_away"}.'
)


class BedrockBrain:
    """Real LLM via AWS Bedrock (Converse API). Uses JSON-mode (not tool-calling) for
    robust structured output — important for Kimi on Bedrock, also fine for Claude."""

    def __init__(self, model_id: Optional[str] = None, region: Optional[str] = None, temperature: float = 0.6) -> None:
        from langchain_aws import ChatBedrockConverse  # lazy: keep tests import-light

        self.model_id = model_id or os.environ.get(
            "BEDROCK_MODEL_ID", "apac.anthropic.claude-sonnet-4-20250514-v1:0"
        )
        self.region = region or os.environ.get("AWS_REGION", "ap-southeast-3")
        self.llm = ChatBedrockConverse(
            model=self.model_id, region_name=self.region, temperature=temperature, max_tokens=1200
        )

    def move(self, *, role, private, current_offer, current_actor, own_last_price, transcript, round_no, max_rounds):
        from langchain_core.messages import HumanMessage, SystemMessage

        from .llm_json import invoke_structured

        msgs = build_messages(
            role=role,  # type: ignore[arg-type]
            private=private,
            current_offer=current_offer,
            current_actor=current_actor,
            transcript=transcript,
            round_no=round_no,
            max_rounds=max_rounds,
        )
        lc = [
            SystemMessage(content=m["content"]) if m["role"] == "system" else HumanMessage(content=m["content"])
            for m in msgs
        ]
        lc.append(HumanMessage(content=_MOVE_FORMAT))
        return invoke_structured(self.llm, lc, AgentMove)


def get_brain(kind: Optional[str] = None) -> Brain:
    """Factory. NEGOTIAI_BRAIN=mock|bedrock (default bedrock)."""
    kind = (kind or os.environ.get("NEGOTIAI_BRAIN", "bedrock")).lower()
    return MockBrain() if kind == "mock" else BedrockBrain()
