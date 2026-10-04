import io
import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

from ml.skin_screening import (
    InvalidSkinImage,
    decode_skin_image,
    extract_features,
    screen_skin_image,
)
from ml.fracture_screening import (
    InvalidXrayImage,
    decode_xray_image,
    extract_xray_features,
    screen_bone_xray,
)
from ml.train_fracture_model import _load_dataset_splits


class _FakeClassifier:
    def decision_function(self, features):
        self.features = features
        return np.array([[0.1, 0.8, -0.2]])


class _FakeBinaryClassifier:
    def predict(self, features):
        self.features = features
        return np.array([1])

    def decision_function(self, features):
        return np.array([0.75])


class SkinScreeningTests(unittest.TestCase):
    def test_decode_and_extract_features_from_supported_image(self):
        buffer = io.BytesIO()
        Image.new("RGB", (96, 80), color=(120, 80, 60)).save(buffer, format="JPEG")

        image = decode_skin_image(buffer.getvalue())
        features = extract_features(image)

        self.assertEqual(image.mode, "RGB")
        self.assertEqual(features.ndim, 1)
        self.assertGreater(features.size, 0)
        self.assertTrue(np.isfinite(features).all())

    def test_rejects_invalid_image_bytes(self):
        with self.assertRaises(InvalidSkinImage):
            decode_skin_image(b"not an image")

    def test_rejects_unsupported_image_format(self):
        buffer = io.BytesIO()
        Image.new("RGB", (64, 64)).save(buffer, format="GIF")

        with self.assertRaises(InvalidSkinImage):
            decode_skin_image(buffer.getvalue())

    def test_screening_returns_ranked_labels_without_probability_claim(self):
        buffer = io.BytesIO()
        Image.new("RGB", (64, 64), color=(120, 80, 60)).save(buffer, format="PNG")
        classifier = _FakeClassifier()
        artifact = {
            "model": classifier,
            "classes": ["Acne", "Eczema", "Moles"],
            "metrics": {
                "accuracy": 0.25,
                "balanced_accuracy": 0.2,
                "test_samples": 20,
            },
        }

        with patch("ml.skin_screening._load_artifact", return_value=artifact):
            result = screen_skin_image(buffer.getvalue())

        self.assertEqual(
            [match["category"] for match in result["matches"]],
            ["Eczema", "Acne", "Moles"],
        )
        self.assertIn("not clinically validated", result["disclaimer"])
        self.assertEqual(classifier.features.shape[0], 1)
        self.assertEqual(result["evaluation"]["test_samples"], 20)

    def test_decode_and_extract_features_from_xray_image(self):
        buffer = io.BytesIO()
        Image.new("L", (96, 80), color=120).save(buffer, format="JPEG")

        image = decode_xray_image(buffer.getvalue())
        features = extract_xray_features(image)

        self.assertEqual(image.mode, "L")
        self.assertEqual(image.size, (128, 128))
        self.assertTrue(np.isfinite(features).all())

    def test_xray_screening_returns_fracture_label_and_evaluation(self):
        buffer = io.BytesIO()
        Image.new("L", (64, 64), color=120).save(buffer, format="PNG")
        classifier = _FakeBinaryClassifier()
        artifact = {
            "model": classifier,
            "metrics": {
                "accuracy": 0.8,
                "balanced_accuracy": 0.7,
                "sensitivity": 0.6,
                "specificity": 0.8,
                "test_samples": 50,
            },
        }

        with patch("ml.fracture_screening._load_artifact", return_value=artifact):
            result = screen_bone_xray(buffer.getvalue())

        self.assertEqual(result["prediction"], "Fracture-class image")
        self.assertEqual(result["matches"][0]["category"], "Fracture-class image")
        self.assertEqual(result["evaluation"]["test_samples"], 50)
        self.assertIn("not clinically validated", result["disclaimer"])
        self.assertEqual(classifier.features.shape[0], 1)

    def test_xray_decoder_rejects_invalid_bytes(self):
        with self.assertRaises(InvalidXrayImage):
            decode_xray_image(b"not an X-ray")

    def test_fracatlas_split_loader_combines_official_fractures_and_disjoint_controls(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            split_dir = root / "Utilities" / "Fracture Split"
            split_dir.mkdir(parents=True)
            for class_name in ("Fractured", "Non_fractured"):
                (root / "images" / class_name).mkdir(parents=True)
            for split_name, image_id in (
                ("train", "fracture-train.jpg"),
                ("valid", "fracture-valid.jpg"),
                ("test", "fracture-test.jpg"),
            ):
                with (root / "images" / "Fractured" / image_id).open("wb") as image_file:
                    Image.new("L", (64, 64), color=160).save(image_file, format="JPEG")
                with (split_dir / f"{split_name}.csv").open("w", newline="") as csv_file:
                    writer = csv.writer(csv_file)
                    writer.writerow(["image_id"])
                    writer.writerow([image_id])
            for index in range(6):
                image_path = root / "images" / "Non_fractured" / f"control-{index}.jpg"
                Image.new("L", (64, 64), color=index * 20).save(image_path, format="JPEG")

            splits, skipped_images = _load_dataset_splits(root)

        self.assertEqual(skipped_images, {"train": 0, "valid": 0, "test": 0})
        self.assertEqual(set(splits), {"train", "valid", "test"})
        all_ids = [image_id for _, _, image_ids in splits.values() for image_id in image_ids]
        self.assertEqual(len(all_ids), len(set(all_ids)))
        for features, labels, _ in splits.values():
            self.assertEqual(features.shape[0], labels.shape[0])
            self.assertEqual(set(labels.tolist()), {0, 1})


if __name__ == "__main__":
    unittest.main()
