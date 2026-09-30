from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from pagematch.embed import PageEmbedder
from pagematch.matcher import PageMatcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("matcher")

# The ONNX session is expensive to create, so the embedder is shared across
# requests while PageMatcher (which only holds tuning params) is built per request.
embedder: PageEmbedder | None = None
match_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global embedder
    logger.info("loading embedding model...")
    embedder = PageEmbedder()
    logger.info("embedding model ready")
    yield


app = FastAPI(title="pdf-page-matcher", lifespan=lifespan)


class MatchRequest(BaseModel):
    path_a: str
    path_b: str
    dpi: int = Field(default=150, ge=36, le=600)
    gap_penalty: float = Field(default=0.35, ge=0.0)
    match_threshold: float = Field(default=0.75, ge=-1.0, le=1.0)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "ready": embedder is not None}


@app.post("/match")
def match(req: MatchRequest) -> dict:
    if embedder is None:
        raise HTTPException(status_code=503, detail="model is still loading")

    for path in (req.path_a, req.path_b):
        if not Path(path).is_file():
            raise HTTPException(status_code=400, detail=f"file not found: {path}")

    logger.info(
        "match request: %s vs %s (dpi=%d, gap=%.2f, threshold=%.2f)",
        Path(req.path_a).name,
        Path(req.path_b).name,
        req.dpi,
        req.gap_penalty,
        req.match_threshold,
    )
    started = time.monotonic()

    matcher = PageMatcher(
        dpi=req.dpi,
        gap_penalty=req.gap_penalty,
        match_threshold=req.match_threshold,
        embedder=embedder,
    )

    try:
        with match_lock:
            result = matcher.match(req.path_a, req.path_b)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("matching failed")
        raise HTTPException(status_code=500, detail=f"matching failed: {exc}") from exc

    logger.info(
        "match done in %.1fs: %d matched, %d removed, %d added",
        time.monotonic() - started,
        len(result.matched),
        len(result.removed_from_a),
        len(result.added_in_b),
    )

    pairs = []
    for pair in result.pairs:
        if pair.index_a is not None and pair.index_b is not None:
            status = "matched"
        elif pair.index_a is not None:
            status = "removed"
        else:
            status = "added"
        pairs.append(
            {
                "page_a": None if pair.index_a is None else pair.index_a + 1,
                "page_b": None if pair.index_b is None else pair.index_b + 1,
                "score": round(pair.score, 4),
                "status": status,
            }
        )

    return {
        "pairs": pairs,
        "summary": {
            "matched": len(result.matched),
            "removed": len(result.removed_from_a),
            "added": len(result.added_in_b),
        },
    }
