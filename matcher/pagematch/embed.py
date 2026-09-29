from __future__ import annotations

from pathlib import Path

import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download
from PIL import Image


IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class PageEmbedder:
    MODEL_REPO = "onnx-community/dinov2-small"
    MODEL_FILE = "onnx/model.onnx"

    def __init__(self, model_path: str | Path | None = None) -> None:
        if model_path is None:
            model_path = hf_hub_download(
                repo_id=self.MODEL_REPO,
                filename=self.MODEL_FILE,
            )
        self.session = ort.InferenceSession(
            str(model_path),
            providers=["CPUExecutionProvider"],
        )
        self.input_name = self.session.get_inputs()[0].name

    def _preprocess(self, image: Image.Image) -> np.ndarray:
        image = image.convert("RGB").resize((224, 224), Image.Resampling.BICUBIC)
        array = np.asarray(image, dtype=np.float32) / 255.0
        array = (array - IMAGENET_MEAN) / IMAGENET_STD
        array = array.transpose(2, 0, 1)
        return array[np.newaxis, ...]

    def embed(self, images: list[Image.Image], batch_size: int = 4) -> np.ndarray:
        if not images:
            return np.empty((0, 0), dtype=np.float32)

        vectors: list[np.ndarray] = []
        for start in range(0, len(images), batch_size):
            batch = images[start : start + batch_size]
            batch_input = np.concatenate([self._preprocess(image) for image in batch], axis=0)
            outputs = self.session.run(None, {self.input_name: batch_input})
            cls_tokens = outputs[0][:, 0, :]
            norms = np.linalg.norm(cls_tokens, axis=1, keepdims=True)
            cls_tokens = cls_tokens / np.maximum(norms, 1e-12)
            vectors.append(cls_tokens.astype(np.float32))

        return np.vstack(vectors)


def cosine_similarity_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if a.size == 0 or b.size == 0:
        return np.empty((a.shape[0], b.shape[0]), dtype=np.float32)
    return a @ b.T
