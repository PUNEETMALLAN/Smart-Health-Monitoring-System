from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report
from sklearn.svm import LinearSVC

from ml.skin_screening import (
    MODEL_PATH,
    decode_skin_image,
    extract_features,
)

DATASET_REF = "pacificrm/skindiseasedataset"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
MAX_TRAINING_IMAGE_PIXELS = 60_000_000


def _dataset_root(dataset_root: Path | None) -> Path:
    if dataset_root is not None:
        return dataset_root

    import kagglehub

    downloaded = Path(kagglehub.dataset_download(DATASET_REF))
    candidates = list(downloaded.rglob("train"))
    candidates = [path.parent for path in candidates if (path.parent / "test").is_dir()]
    if len(candidates) != 1:
        raise RuntimeError(
            f"Expected one train/test dataset root below {downloaded}, found {len(candidates)}."
        )
    return candidates[0]


def _load_split(split_dir: Path, expected_classes: list[str] | None = None):
    if not split_dir.is_dir():
        raise FileNotFoundError(f"Dataset split was not found: {split_dir}")
    class_dirs = sorted(path for path in split_dir.iterdir() if path.is_dir())
    classes = [path.name for path in class_dirs]
    if expected_classes is not None and classes != expected_classes:
        raise ValueError(f"Class folders differ between train and test in {split_dir}.")

    features: list[np.ndarray] = []
    labels: list[str] = []
    for class_dir in class_dirs:
        image_paths = sorted(
            path for path in class_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
        )
        if not image_paths:
            raise ValueError(f"No supported images found in {class_dir}.")
        for image_path in image_paths:
            try:
                image = decode_skin_image(
                    image_path.read_bytes(),
                    max_image_pixels=MAX_TRAINING_IMAGE_PIXELS,
                )
                features.append(extract_features(image))
                labels.append(class_dir.name)
            except (OSError, ValueError) as error:
                raise ValueError(f"Could not process dataset image {image_path}: {error}") from error

    if not features or set(labels) != set(classes):
        raise ValueError(f"The split {split_dir} is empty or missing class samples.")
    return np.stack(features), np.asarray(labels), classes


def train(dataset_root: Path, output_path: Path = MODEL_PATH) -> dict:
    train_features, train_labels, classes = _load_split(dataset_root / "train")
    test_features, test_labels, _ = _load_split(dataset_root / "test", classes)

    classifier = LinearSVC(
        C=0.1,
        class_weight="balanced",
        dual="auto",
        max_iter=5000,
        random_state=42,
    )
    classifier.fit(train_features, train_labels)
    predictions = classifier.predict(test_features)
    metrics = {
        "accuracy": float(accuracy_score(test_labels, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(test_labels, predictions)),
        "classification_report": classification_report(
            test_labels,
            predictions,
            labels=classes,
            output_dict=True,
            zero_division=0,
        ),
        "train_samples": int(len(train_labels)),
        "test_samples": int(len(test_labels)),
        "train_class_counts": dict(sorted(Counter(train_labels).items())),
        "test_class_counts": dict(sorted(Counter(test_labels).items())),
        "dataset": DATASET_REF,
        "clinical_validation": False,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": classifier,
            "classes": classes,
            "metrics": metrics,
            "feature_version": 1,
        },
        output_path,
        compress=3,
    )
    print(f"Model saved to {output_path}")
    print(f"Held-out accuracy: {metrics['accuracy']:.4f}")
    print(f"Held-out balanced accuracy: {metrics['balanced_accuracy']:.4f}")
    print(f"Training images: {metrics['train_samples']}; test images: {metrics['test_samples']}")
    print("This dataset evaluation is not clinical validation.")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the experimental skin-image classifier.")
    parser.add_argument(
        "--dataset-root",
        type=Path,
        help="Directory containing train/ and test/ class folders; defaults to the KaggleHub dataset.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=MODEL_PATH,
        help=f"Model artifact destination (default: {MODEL_PATH}).",
    )
    args = parser.parse_args()
    train(_dataset_root(args.dataset_root), args.output)


if __name__ == "__main__":
    main()
