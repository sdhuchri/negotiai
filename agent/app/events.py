"""Emit negotiation events to the Go backend (decision #2: Python -> Go webhook)."""

from __future__ import annotations

import os

import httpx

BACKEND = os.environ.get("BACKEND_INTERNAL_URL", "http://backend:8080")


def emit(event: dict) -> None:
    try:
        httpx.post(f"{BACKEND}/internal/events", json=event, timeout=8.0)
    except Exception as e:  # best-effort; never crash the run
        print(f"[events] emit failed: {e}")
