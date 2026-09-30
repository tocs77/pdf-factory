from __future__ import annotations

import logging
import re
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image

logger = logging.getLogger(__name__)

PAGE_IMAGE_PATTERN = re.compile(r"^page-(\d+)\.(png|jpg|jpeg|webp)$", re.IGNORECASE)


def render_pdf_pages(pdf_path: str | Path, dpi: int = 150) -> list[Image.Image]:
    pdf_path = Path(pdf_path)
    scale = dpi / 72.0
    images: list[Image.Image] = []

    pdf = pdfium.PdfDocument(str(pdf_path))
    total = len(pdf)
    logger.info("rendering %d pages from %s", total, pdf_path.name)
    try:
        for page_index in range(total):
            page = pdf[page_index]
            bitmap = page.render(scale=scale)
            images.append(bitmap.to_pil().convert("RGB"))
            if (page_index + 1) % 10 == 0 or page_index + 1 == total:
                logger.info("  rendered %d/%d pages", page_index + 1, total)
    finally:
        pdf.close()

    return images


def load_page_images(directory: str | Path) -> list[Image.Image]:
    directory = Path(directory)
    if not directory.is_dir():
        raise FileNotFoundError(f"page image directory not found: {directory}")

    entries: list[tuple[int, Path]] = []
    for path in directory.iterdir():
        if not path.is_file():
            continue
        match = PAGE_IMAGE_PATTERN.match(path.name)
        if match:
            entries.append((int(match.group(1)), path))

    if not entries:
        raise ValueError(f"no page-NNN images found in {directory}")

    entries.sort(key=lambda item: item[0])
    return [Image.open(path).convert("RGB") for _, path in entries]
