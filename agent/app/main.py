"""FastAPI surface for the agent service.

- /analyze : free-form intake text -> structured params (per side, asymmetry-safe)
- /run     : start the negotiation graph (background), streaming events to Go
- /resume  : resume after a human decision (approval/escalation)
- /demo, /scenarios, /health : standalone helpers
"""

from __future__ import annotations

from fastapi import BackgroundTasks, FastAPI, HTTPException
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from pydantic import BaseModel

from .brains import get_brain
from .graph import build_graph
from .intake import get_analyzer
from .runner import resume_negotiation, run_negotiation
from .scenarios import SCENARIOS, make_initial_state
from .state import Offer, UserGuardrail, VendorPrivate

app = FastAPI(title="NegotiAI Agent", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# ---------- intake analysis (step 2) ----------

class AnalyzeRequest(BaseModel):
    user_text: str = ""
    vendor_text: str = ""


@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    a = get_analyzer()
    ug = a.analyze_user(req.user_text)
    vp, offer = a.analyze_vendor(req.vendor_text)
    return {
        "user_guardrail": ug.model_dump(),
        "vendor_private": vp.model_dump(),
        "vendor_offer": offer.model_dump(),
    }


# ---------- run / resume ----------

class RunRequest(BaseModel):
    negotiation_id: str
    user_guardrail: UserGuardrail
    vendor_private: VendorPrivate
    vendor_offer: Offer
    max_rounds: int = 8


@app.post("/run")
def run(req: RunRequest, bg: BackgroundTasks) -> dict:
    bg.add_task(
        run_negotiation,
        req.negotiation_id,
        req.user_guardrail,
        req.vendor_private,
        req.vendor_offer,
        req.max_rounds,
    )
    return {"status": "started", "negotiation_id": req.negotiation_id}


class ResumeRequest(BaseModel):
    negotiation_id: str
    decision: dict


@app.post("/resume")
def resume(req: ResumeRequest, bg: BackgroundTasks) -> dict:
    bg.add_task(resume_negotiation, req.negotiation_id, req.decision)
    return {"status": "resumed", "negotiation_id": req.negotiation_id}


# ---------- standalone helpers ----------

@app.get("/scenarios")
def scenarios() -> dict:
    return {k: v.description for k, v in SCENARIOS.items()}


@app.post("/demo/{name}")
def demo(name: str) -> dict:
    if name not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"unknown scenario '{name}'")
    graph = build_graph(get_brain(), checkpointer=MemorySaver())
    cfg = {"configurable": {"thread_id": f"demo-{name}"}, "recursion_limit": 60}
    res = graph.invoke(make_initial_state(SCENARIOS[name], name), cfg)
    while "__interrupt__" in res:
        intr = res["__interrupt__"][0].value
        decision = {"decision": "approve"} if intr.get("type") == "approval" else {"decision": "reject"}
        res = graph.invoke(Command(resume=decision), cfg)
    return {"status": res.get("status"), "result": res.get("result"), "transcript": res.get("transcript")}
