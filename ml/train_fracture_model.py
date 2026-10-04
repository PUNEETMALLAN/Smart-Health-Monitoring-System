from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.svm import LinearSVC

from ml.fracture_screening import (
    MODEL_PATH,
    decode_xray_image,
    extract_xray_features,
)

DATASET_REF = "mahmudulhasantasin/fracatlas-original-dataset"
MAX_TRAINING_IMAGE_PIXELS = 60_000_000
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _dataset_root(dataset_root: Path | None) -> Path:
    if dataset_root is not None:
        return dataset_root

    import kagglehub

    downloaded = Path(kagglehub.dataset_download(DATASET_REF))
    candidates = list(downloaded.rglob("train.csv"))
    candidates = [path.parent.parent for path in candidates if (path.parent.parent / "images").is_dir()]
    if len(candidates) != 1:
        raise RuntimeError(
            f"Expected one FracAtlas root containing images/ and split CSVs below {downloaded}, "
            f"found {len(candidates)}."
        )
    return candidates[0]


def _read_official_fracture_splits(dataset_root: Path) -> dict[str, list[str]]:
    split_dir = dataset_root / "Utilities" / "Fracture Split"
    splits: dict[str, list[str]] = {}
    seen: set[str] = set()
    for split_name in ("train", "valid", "test"):
        split_path = split_dir / f"{split_name}.csv"
        if not split_path.is_file():
            raise FileNotFoundError(f"FracAtlas split CSV was not found: {split_path}")
        with split_path.open("r", newline="", encoding="utf-8-sig") as csv_file:
            reader = csv.DictReader(csv_file)
            if "image_id" not in (reader.fieldnames or []):
                raise ValueError(f"Expected an image_id column in {split_path}.")
            image_ids = [row["image_id"].strip() for row in reader if row.get("image_id", "").strip()]
        if not image_ids or len(image_ids) != len(set(image_ids)):
            raise ValueError(f"The FracAtlas split {split_path} is empty or has duplicate image IDs.")
        overlap = seen.intersection(image_ids)
        if overlap:
            raise ValueError(f"FracAtlas fracture splits overlap at image {sorted(overlap)[0]}.")
        seen.update(image_ids)
        splits[split_name] = image_ids
    return splits


def _load_dataset_splits(dataset_root: Path):
    image_lookup: dict[str, tuple[Path, int]] = {}
    for class_name, label in (("Non_fractured", 0), ("Fractured", 1)):
        class_dir = dataset_root / "images" / class_name
        if not class_dir.is_dir():
            raise FileNotFoundError(f"FracAtlas class directory was not found: {class_dir}")
        for path in class_dir.rglob("*"):
            if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
                if path.name in image_lookup:
                    raise ValueError(f"Duplicate image filename found in FracAtlas: {path.name}.")
                image_lookup[path.name] = (path, label)
    positive_splits = _read_official_fracture_splits(dataset_root)
    for split_name, image_ids in positive_splits.items():
        for image_id in image_ids:
            label_entry = image_lookup.get(image_id)
            if label_entry is None or label_entry[1] != 1:
                raise ValueError(
                    f"FracAtlas {split_name} split image {image_id} is missing or not labeled Fractured."
                )

    negative_ids = sorted(
        image_id for image_id, (_, label) in image_lookup.items() if label == 0
    )
    rng = np.random.default_rng(42)
    shuffled_negative_ids = np.asarray(negative_ids)[rng.permutation(len(negative_ids))]
    positive_counts = np.asarray(
        [len(positive_splits[name]) for name in ("train", "valid", "test")],
        dtype=np.float64,
    )
    exact_negative_counts = len(negative_ids) * positive_counts / positive_counts.sum()
    negative_counts = np.floor(exact_negative_counts).astype(int)
    for index in np.argsort(-(exact_negative_counts - negative_counts))[
        : len(negative_ids) - int(negative_counts.sum())
    ]:
        negative_counts[index] += 1

    split_ids: dict[str, list[str]] = {}
    negative_offset = 0
    for index, split_name in enumerate(("train", "valid", "test")):
        negative_end = negative_offset + int(negative_counts[index])
        split_negative_ids = shuffled_negative_ids[negative_offset:negative_end].tolist()
        negative_offset = negative_end
        ids = positive_splits[split_name] + split_negative_ids
        rng.shuffle(ids)
        split_ids[split_name] = ids

    data: dict[str, tuple[np.ndarray, np.ndarray, list[str]]] = {}
    skipped_images: dict[str, int] = {}
    for split_name, ids in split_ids.items():
        features = []
        labels = []
        processed_ids = []
        skipped = 0
        for image_id in ids:
            image_path, label = image_lookup[image_id]
            try:
                image = decode_xray_image(
                    image_path.read_bytes(),
                    max_image_pixels=MAX_TRAINING_IMAGE_PIXELS,
                )
                features.append(extract_xray_features(image))
                labels.append(label)
            except (OSError, ValueError) as error:
                skipped += 1
                print(f"Skipping unreadable FracAtlas image {image_path.name}: {error}")
                continue
            processed_ids.append(image_id)
        if not features:
            raise ValueError(f"No readable images remained in the FracAtlas {split_name} split.")
        data[split_name] = (
            np.stack(features),
            np.asarray(labels, dtype=np.int64),
            processed_ids,
        )
        skipped_images[split_name] = skipped
    return data, skipped_images


def train(dataset_root: Path, output_path: Path = MODEL_PATH) -> dict:
    dataset_splits, skipped_images = _load_dataset_splits(dataset_root)
    train_features, train_labels, train_ids = dataset_splits["train"]
    valid_features, valid_labels, valid_ids = dataset_splits["valid"]
    test_features, test_labels, test_ids = dataset_splits["test"]

    if set(np.unique(train_labels)) != {0, 1}:
        raise ValueError("The FracAtlas training split must contain both fracture classes.")
    if set(np.unique(test_labels)) != {0, 1}:
        raise ValueError("The readable FracAtlas test split must contain both fracture classes.")
    if (set(train_ids) & set(valid_ids)) or (set(train_ids) & set(test_ids)) or (set(valid_ids) & set(test_ids)):
        raise ValueError("FracAtlas train, validation, and test splits must not overlap.")

    classifier = LinearSVC(
        C=0.1,
        class_weight="balanced",
        dual="auto",
        max_iter=5000,
        random_state=42,
    )
    classifier.fit(train_features, train_labels)
    predictions = classifier.predict(test_features)
    matrix = confusion_matrix(test_labels, predictions, labels=[0, 1])
    true_negative, false_positive, false_negative, true_positive = matrix.ravel()
    metrics = {
        "accuracy": float(accuracy_score(test_labels, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(test_labels, predictions)),
        "sensitivity": float(true_positive / (true_positive + false_negative))
        if true_positive + false_negative else 0.0,
        "specificity": float(true_negative / (true_negative + false_positive))
        if true_negative + false_positive else 0.0,
        "classification_report": classification_report(
            test_labels,
            predictions,
            labels=[0, 1],
            target_names=["Non_fractured", "Fractured"],
            output_dict=True,
            zero_division=0,
        ),
        "confusion_matrix": matrix.tolist(),
        "train_samples": int(len(train_labels)),
        "validation_samples": int(len(valid_labels)),
        "test_samples": int(len(test_labels)),
        "train_class_counts": dict(sorted(Counter(train_labels.tolist()).items())),
        "test_class_counts": dict(sorted(Counter(test_labels.tolist()).items())),
        "skipped_unreadable_images": skipped_images,
        "dataset": DATASET_REF,
        "clinical_validation": False,
        "negative_control_split": "deterministic random assignment, seed 42, matched to positive split proportions",
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"model": classifier, "metrics": metrics, "feature_version": 1},
        output_path,
        compress=3,
    )
    print(f"Model saved to {output_path}")
    print(f"Held-out accuracy: {metrics['accuracy']:.4f}")
    print(f"Held-out balanced accuracy: {metrics['balanced_accuracy']:.4f}")
    print(
        f"Sensitivity: {metrics['sensitivity']:.4f}; specificity: {metrics['specificity']:.4f}"
    )
    print(
        f"Training images: {metrics['train_samples']}; validation images: "
        f"{metrics['validation_samples']}; test images: {metrics['test_samples']}"
    )
    print(f"Skipped unreadable images by split: {skipped_images}")
    print("This dataset evaluation is not clinical validation.")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train an experimental binary fracture classifier using FracAtlas."
    )
    parser.add_argument(
        "--dataset-root",
        type=Path,
        help="FracAtlas directory containing images/ and Utilities/Fracture Split/*.csv.",
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
