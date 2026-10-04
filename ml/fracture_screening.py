from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from skimage.feature import hog

MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "fracatlas_classifier.joblib"
IMAGE_SIZE = (128, 128)
MAX_IMAGE_PIXELS = 25_000_000
SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}
CLASS_LABELS = {0: "Non-fracture-class image", 1: "Fracture-class image"}


class InvalidXrayImage(ValueError):
    """Raised when an uploaded X-ray is not a supported, safely decodable image."""


class FractureModelNotConfigured(RuntimeError):
    """Raised when the trained FracAtlas classifier is unavailable."""


def decode_xray_image(image_bytes: bytes, max_image_pixels: int = MAX_IMAGE_PIXELS) -> Image.Image:
    if not image_bytes:
        raise InvalidXrayImage("The uploaded image is empty.")

    try:
        with Image.open(BytesIO(image_bytes)) as source:
            if source.format not in SUPPORTED_FORMATS:
                raise InvalidXrayImage("Choose a JPG, PNG, or WebP X-ray image.")
            if source.width < 32 or source.height < 32:
                raise InvalidXrayImage("The image must be at least 32 by 32 pixels.")
            if source.width * source.height > max_image_pixels:
                raise InvalidXrayImage("The image dimensions are too large to process safely.")
            source.verify()

        with Image.open(BytesIO(image_bytes)) as source:
            oriented = ImageOps.exif_transpose(source).convert("L")
            return ImageOps.fit(oriented, IMAGE_SIZE)
    except InvalidXrayImage:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise InvalidXrayImage("The image dimensions are too large to process safely.") from error
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise InvalidXrayImage("The uploaded file is not a valid JPG, PNG, or WebP image.") from error


def extract_xray_features(image: Image.Image) -> np.ndarray:
    gray = np.asarray(image.convert("L"), dtype=np.float32) / 255.0
    texture = hog(
        gray,
        orientations=9,
        pixels_per_cell=(16, 16),
        cells_per_block=(2, 2),
        block_norm="L2-Hys",
    )
    intensity = np.histogram(gray, bins=32, range=(0, 1), density=True)[0]
    return np.concatenate((texture, intensity)).astype(np.float32, copy=False)


@lru_cache(maxsize=1)
def _load_artifact() -> dict[str, Any]:
    if not MODEL_PATH.is_file():
        raise FractureModelNotConfigured(
            "The FracAtlas model has not been trained. Run ml/train_fracture_model.py first."
        )
    artifact = joblib.load(MODEL_PATH)
    if not isinstance(artifact, dict) or not {"model", "metrics"} <= artifact.keys():
        raise FractureModelNotConfigured("The FracAtlas model artifact is invalid.")
    return artifact


def screen_bone_xray(image_bytes: bytes) -> dict[str, Any]:
    image = decode_xray_image(image_bytes)
    features = extract_xray_features(image).reshape(1, -1)
    artifact = _load_artifact()
    model = artifact["model"]
    prediction = int(model.predict(features)[0])
    decision = float(np.asarray(model.decision_function(features)).reshape(-1)[0])
    matches = sorted(
        [
            {"category": CLASS_LABELS[0], "relative_score": round(-decision, 4)},
            {"category": CLASS_LABELS[1], "relative_score": round(decision, 4)},
        ],
        key=lambda match: match["relative_score"],
        reverse=True,
    )
    return {
        "prediction": CLASS_LABELS[prediction],
        "matches": matches,
        "evaluation": {
            "held_out_accuracy": float(artifact["metrics"]["accuracy"]),
            "held_out_balanced_accuracy": float(artifact["metrics"]["balanced_accuracy"]),
            "held_out_sensitivity": float(artifact["metrics"]["sensitivity"]),
            "held_out_specificity": float(artifact["metrics"]["specificity"]),
            "test_samples": int(artifact["metrics"]["test_samples"]),
            "negative_control_split": "deterministic random assignment, seed 42",
        },
        "model": "experimental-fracatlas-fracture-classifier",
        "disclaimer": (
            "Research prototype for musculoskeletal radiographs only; not clinically validated. "
            "This output is not a diagnosis. Consult a radiologist or qualified healthcare professional."
        ),
    }
