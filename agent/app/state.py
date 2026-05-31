"""Negotiation state & domain types.

Information asymmetry is structural here: `user_private` and `vendor_private` are
SEPARATE slices. A node must only ever read its own side's private slice plus the
public history (see prompts.build_messages + tests/test_asymmetry.py).
"""

from __future__ import annotations

from typing import Literal, Optional, TypedDict

from pydantic import BaseModel, Field

Actor = Literal["vendor", "user"]
Priority = Literal["price", "lead_time", "warranty", "payment_terms"]
Status = Literal[
    "negotiating",
    "awaiting_approval",
    "escalated",
    "deal",
    "walked_away",
]
MoveAction = Literal["counter", "accept", "walk_away"]


class Offer(BaseModel):
    price: float
    lead_time_days: int = 30


class UserGuardrail(BaseModel):
    """User's corridor — PRIVATE to the User Agent."""

    max_price: float
    target_price: Optional[float] = None
    max_lead_time_days: int = 60
    priority: Priority = "price"


class VendorPrivate(BaseModel):
    """Vendor's corridor — PRIVATE to the Vendor Agent (decision #7)."""

    floor_price: float  # vendor will not go below this
    target_margin: Optional[float] = None
    min_lead_time_days: int = 7


class AgentMove(BaseModel):
    """Structured output an agent brain must produce (LLM is constrained to this)."""

    public_message: str = Field(description="Pesan publik singkat ke lawan negosiasi.")
    internal_reasoning: str = Field(description="Alasan internal (tidak dilihat lawan).")
    proposed_price: float = Field(description="Harga yang diusulkan ronde ini.")
    proposed_lead_time: int = Field(default=30, description="Lead time (hari) yang diusulkan.")
    action: MoveAction = Field(default="counter")


class TranscriptEntry(TypedDict):
    round_no: int
    actor: Actor
    public_message: str
    internal_reasoning: str
    price: float
    lead_time: int
    action: str


class NegotiationState(TypedDict, total=False):
    negotiation_id: str
    round_no: int
    max_rounds: int

    # PRIVATE slices — never crossed between agents
    user_private: UserGuardrail
    vendor_private: VendorPrivate

    # PUBLIC / shared
    current_offer: Offer  # latest offer on the table
    current_actor: Actor  # who made current_offer
    vendor_last_price: Optional[float]
    user_last_price: Optional[float]
    transcript: list[TranscriptEntry]

    # CONTROL (deterministic)
    status: Status
    stagnant_rounds: int
    result: dict
    human_decision: dict  # resume payload from human_gate / escalate_gate (must be a channel!)
