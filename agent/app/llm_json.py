"""Robust JSON-mode structured output for Bedrock chat models.

Instead of tool-calling (flaky for Kimi on Bedrock Converse — internal tokens can leak
into text), we ask the model for a pure JSON object and parse it ourselves, with a
brace-balanced extractor (tolerant of stray text/fences) and a retry nudge.
"""

from __future__ import annotations

import json
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def _content_to_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for b in content:
            if isinstance(b, dict):
                parts.append(b.get("text") or b.get("content") or "")
            else:
                parts.append(str(b))
        return "".join(parts)
    return str(content)


def extract_json(text: str) -> Optional[dict]:
    """Return the first balanced {...} object parsed from text, tolerating fences/leaked tokens."""
    if not text:
        return None
    start = text.find("{")
    while start != -1:
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(text)):
            c = text[i]
            if in_str:
                if esc:
                    esc = False
                elif c == "\\":
                    esc = True
                elif c == '"':
                    in_str = False
            else:
                if c == '"':
                    in_str = True
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start : i + 1])
                        except json.JSONDecodeError:
                            break  # malformed; try next "{"
        start = text.find("{", start + 1)
    return None


def invoke_structured(llm, messages: list, model_cls: Type[T], retries: int = 2) -> T:
    """Invoke an LLM and coerce its JSON reply into a pydantic model, retrying on failure."""
    from langchain_core.messages import HumanMessage

    last_err: Optional[Exception] = None
    msgs = list(messages)
    for attempt in range(retries + 1):
        resp = llm.invoke(msgs)
        data = extract_json(_content_to_text(resp.content))
        if data is not None:
            try:
                return model_cls.model_validate(data)
            except Exception as e:  # noqa: BLE001
                last_err = e
        else:
            last_err = ValueError("no JSON object in model output")
        msgs = list(messages) + [
            HumanMessage(content="Output tidak valid. Balas HANYA satu objek JSON valid sesuai skema, tanpa teks lain.")
        ]
    raise ValueError(f"structured parse failed after {retries + 1} attempts: {last_err}")
