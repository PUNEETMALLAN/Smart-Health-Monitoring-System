# Skin image screening prototype

This experimental module extracts HOG texture and RGB color-histogram features from skin images
and trains a balanced linear SVM on the `pacificrm/skindiseasedataset` Kaggle dataset. It uses
the dataset's existing `train/` and `test/` class-folder splits and reports held-out metrics.

## Train

From the repository root, install the backend and training dependencies, then run:

```sh
backend/.venv/bin/python -m pip install -r backend/requirements.txt -r ml/requirements.txt
backend/.venv/bin/python -m ml.train_skin_model
```

KaggleHub downloads the dataset if it is not already cached. To use a local copy instead:

```sh
backend/.venv/bin/python -m ml.train_skin_model --dataset-root /path/to/SkinDisease
```

The dataset root must contain `train/` and `test/` folders, each with one folder per class.
Training writes the model and held-out evaluation metrics to
`ml/artifacts/skin_image_classifier.joblib`; this generated artifact is ignored by Git.

## API

After training, start the backend from the repository root and send a JPG, PNG, or WebP file as
multipart form field `file` to `POST /screen-skin-image`. Uploads are not stored by this feature.
The endpoint is unavailable with HTTP 503 until a model artifact has been trained.

This is a research/demo prototype, not a diagnostic or clinically validated system. Dataset
held-out metrics do not establish clinical performance, and model scores are not probabilities.

## FracAtlas musculoskeletal X-ray screening

The `mahmudulhasantasin/fracatlas-original-dataset` Kaggle dataset contains bone
musculoskeletal radiographs with `Fractured` and `Non_fractured` labels and official
train/validation/test CSV splits. It is not a dental X-ray dataset. To train the separate
experimental fracture classifier:

```sh
backend/.venv/bin/python -m ml.train_fracture_model
```

To use a local dataset copy:

```sh
backend/.venv/bin/python -m ml.train_fracture_model --dataset-root /path/to/FracAtlas
```

The root must contain `images/Fractured`, `images/Non_fractured`, and
`Utilities/Fracture Split/{train,valid,test}.csv`. The model is saved to
`ml/artifacts/fracatlas_classifier.joblib`. It uses the official train split and reports results
on the separate test split; the validation split is kept separate. The provided split CSVs list
fracture-positive images only, so non-fracture controls are deterministically assigned to the
same proportions with random seed 42. Unreadable source images are reported and excluded from
training/evaluation.

The application image-screening page offers separate skin-photo and musculoskeletal bone-X-ray
flows. The endpoint `POST /screen-bone-xray` accepts a JPG, PNG, or WebP image as multipart field
`file`. Neither classifier makes a diagnosis, and neither has been clinically validated.
FracAtlas is not a dental radiograph dataset, and a non-fracture-class result must not be used to
rule out a fracture.
