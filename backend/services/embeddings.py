"""
Semantic embeddings for bio/playstyle matching.

A user's free-text bio is embedded into a vector (OpenAI text-embedding-3-small);
matching then adds a "similar playing style" signal from the cosine similarity of
two bios. This is the genuine-AI layer on top of the transparent heuristic.

Degrades gracefully: with no OPENAI_API_KEY (or any failure) embed_text returns
None, the stored embedding stays null, and the semantic signal is simply skipped.
"""
from __future__ import annotations
import os
from typing import Optional, Sequence

EMBED_MODEL = "text-embedding-3-small"


def embed_text(text: str | None) -> Optional[list[float]]:
    """Embed text, or None when there's no API key / no text / any failure."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key or not (text or "").strip():
        return None
    try:
        from openai import OpenAI  # local import — only loaded when used
        client = OpenAI(api_key=key)
        rsp = client.embeddings.create(model=EMBED_MODEL, input=text[:2000])
        return rsp.data[0].embedding
    except Exception:  # noqa: BLE001 — never let embedding break a profile save
        return None


def cosine(a: Sequence[float] | None, b: Sequence[float] | None) -> float:
    """Cosine similarity in [-1, 1]; 0.0 if either is missing/empty/mismatched."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
