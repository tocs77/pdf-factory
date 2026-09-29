from __future__ import annotations

import re
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image


PAGE_IMAGE_PATTERN = re.compile(r"^page-(\d+)\.(png|jpg|jpeg|webp)$", re.IGNORECASE)


def render_pdf_pages(pdf_path: str | Path, dpi: int = 150) -> list[Image.Image]:
    pdf_path = Path(pdf_path)
    scale = dpi / 72.0
    images: list[Image.Image] = []

    pdf = pdfium.PdfDocument(str(pdf_path))
    try:
        for page_index in range(len(pdf)):
            page = pdf[page_index]
            bitmap = page.render(scale=scale)
            images.append(bitmap.to_pil().convert("RGB"))
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
