from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from pagematch.align import AlignmentPair, needleman_wunsch
from pagematch.embed import PageEmbedder, cosine_similarity_matrix
from pagematch.render import load_page_images, render_pdf_pages


@dataclass(frozen=True)
class MatchResult:
    pairs: list[AlignmentPair]
    similarity: np.ndarray
    pages_a: list[Image.Image]
    pages_b: list[Image.Image]
    source_a: str
    source_b: str

    @property
    def matched(self) -> list[AlignmentPair]:
        return [pair for pair in self.pairs if pair.index_a is not None and pair.index_b is not None]

    @property
    def removed_from_a(self) -> list[int]:
        return [pair.index_a for pair in self.pairs if pair.index_a is not None and pair.index_b is None]

    @property
    def added_in_b(self) -> list[int]:
        return [pair.index_b for pair in self.pairs if pair.index_b is not None and pair.index_a is None]


class PageMatcher:
    def __init__(
        self,
        dpi: int = 150,
        gap_penalty: float = 0.35,
        match_threshold: float = 0.75,
        model_path: str | Path | None = None,
        embedder: PageEmbedder | None = None,
    ) -> None:
        self.dpi = dpi
        self.gap_penalty = gap_penalty
        self.match_threshold = match_threshold
        self.embedder = embedder or PageEmbedder(model_path=model_path)

    def load_pages(self, source: str | Path) -> list[Image.Image]:
        source = Path(source)
        if source.is_dir():
            return load_page_images(source)
        if source.suffix.lower() == ".pdf":
            return render_pdf_pages(source, dpi=self.dpi)
        raise ValueError(f"unsupported source: {source}")

    def match(self, source_a: str | Path, source_b: str | Path) -> MatchResult:
        pages_a = self.load_pages(source_a)
        pages_b = self.load_pages(source_b)

        embeddings_a = self.embedder.embed(pages_a)
        embeddings_b = self.embedder.embed(pages_b)
        similarity = cosine_similarity_matrix(embeddings_a, embeddings_b)
        pairs = needleman_wunsch(
            similarity,
            gap_penalty=self.gap_penalty,
            match_threshold=self.match_threshold,
        )
        return MatchResult(
            pairs=pairs,
            similarity=similarity,
            pages_a=pages_a,
            pages_b=pages_b,
            source_a=str(source_a),
            source_b=str(source_b),
        )
