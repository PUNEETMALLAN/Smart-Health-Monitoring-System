from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from skimage.feature import hog

MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "skin_image_classifier.joblib"
IMAGE_SIZE = (128, 128)
MAX_IMAGE_PIXELS = 25_000_000
SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}


class InvalidSkinImage(ValueError):
    """Raised when an uploaded file is not a supported, safely decodable image."""


class SkinModelNotConfigured(RuntimeError):
    """Raised when the trained skin-image model artifact is not available."""


def decode_skin_image(
    image_bytes: bytes,
    max_image_pixels: int = MAX_IMAGE_PIXELS,
) -> Image.Image:
    if not image_bytes:
        raise InvalidSkinImage("The uploaded image is empty.")

    try:
        with Image.open(BytesIO(image_bytes)) as source:
            if source.format not in SUPPORTED_FORMATS:
                raise InvalidSkinImage("Choose a JPG, PNG, or WebP image.")
            if source.width < 32 or source.height < 32:
                raise InvalidSkinImage("The image must be at least 32 by 32 pixels.")
            if source.width * source.height > max_image_pixels:
                raise InvalidSkinImage("The image dimensions are too large to process safely.")
            source.verify()

        with Image.open(BytesIO(image_bytes)) as source:
            return ImageOps.exif_transpose(source).convert("RGB")
    except InvalidSkinImage:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise InvalidSkinImage("The image dimensions are too large to process safely.") from error
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise InvalidSkinImage("The uploaded file is not a valid JPG, PNG, or WebP image.") from error


def extract_features(image: Image.Image) -> np.ndarray:
    resized = ImageOps.fit(image.convert("RGB"), IMAGE_SIZE)
    rgb = np.asarray(resized, dtype=np.uint8)
    gray = np.asarray(resized.convert("L"), dtype=np.float32) / 255.0

    texture = hog(
        gray,
        orientations=9,
        pixels_per_cell=(16, 16),
        cells_per_block=(2, 2),
        block_norm="L2-Hys",
    )
    color = np.concatenate([
        np.histogram(rgb[:, :, channel], bins=16, range=(0, 256), density=True)[0]
        for channel in range(3)
    ])
    return np.concatenate((texture, color)).astype(np.float32, copy=False)


@lru_cache(maxsize=1)
def _load_artifact() -> dict[str, Any]:
    if not MODEL_PATH.is_file():
        raise SkinModelNotConfigured(
            "The skin-image model has not been trained. Run ml/train_skin_model.py first."
        )
    artifact = joblib.load(MODEL_PATH)
    if not isinstance(artifact, dict) or not {"model", "classes", "metrics"} <= artifact.keys():
        raise SkinModelNotConfigured("The skin-image model artifact is invalid.")
    return artifact


def screen_skin_image(image_bytes: bytes) -> dict[str, Any]:
    image = decode_skin_image(image_bytes)
    features = extract_features(image).reshape(1, -1)
    artifact = _load_artifact()
    scores = np.asarray(artifact["model"].decision_function(features)).reshape(-1)
    classes = list(artifact["classes"])
    if scores.size != len(classes):
        raise SkinModelNotConfigured("The skin-image model returned an invalid result.")

    top_indices = np.argsort(scores)[::-1][:3]
    return {
        "matches": [
            {"category": str(classes[index]), "relative_score": round(float(scores[index]), 4)}
            for index in top_indices
        ],
        "evaluation": {
            "held_out_accuracy": float(artifact["metrics"]["accuracy"]),
            "held_out_balanced_accuracy": float(artifact["metrics"]["balanced_accuracy"]),
            "test_samples": int(artifact["metrics"]["test_samples"]),
        },
        "model": "experimental-skin-image-classifier",
        "disclaimer": (
            "Research prototype only; not clinically validated. These image categories are "
            "not a diagnosis. Consult a qualified healthcare professional."
        ),
    }
