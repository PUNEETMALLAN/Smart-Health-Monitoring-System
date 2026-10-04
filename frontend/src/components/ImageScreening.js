import React, { useEffect, useState } from 'react';
import { healthService } from '../services/healthService';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ImageScreening = () => {
  const [imageType, setImageType] = useState('skin');
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(image);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const handleImageChange = (event) => {
    const selectedImage = event.target.files?.[0];
    event.target.value = '';
    setError('');

    if (!selectedImage) return;
    setImage(null);
    setResult(null);
    if (!SUPPORTED_IMAGE_TYPES.includes(selectedImage.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (selectedImage.size > MAX_IMAGE_SIZE_BYTES) {
      setError('The image must be 10 MB or smaller.');
      return;
    }

    setImage(selectedImage);
  };

  const clearImage = () => {
    setImage(null);
    setError('');
    setResult(null);
  };

  const handleImageTypeChange = (event) => {
    setImageType(event.target.value);
    setImage(null);
    setError('');
    setResult(null);
  };

  const analyzeImage = async () => {
    if (!image || isAnalyzing) return;

    setIsAnalyzing(true);
    setError('');
    setResult(null);
    try {
      const screenImage = imageType === 'skin'
        ? healthService.screenSkinImage
        : healthService.screenBoneXray;
      setResult(await screenImage(image));
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
        'The image could not be screened. Please try again later.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="glass-panel dashboard-card card-span-2 image-screening-card">
      <div className="panel-row between">
        <div>
          <span className="panel-icon small">🩻</span>
          <strong>Image Screening</strong>
        </div>
        <span className="tag">Experimental</span>
      </div>

      <p className="image-screening-intro">
        Choose an image type. Skin photos use the skin-disease dataset classifier; bone X-rays use
        the FracAtlas fracture classifier. Images are analyzed for this request and are not saved.
      </p>

      <label className="image-screening-type">
        Image type
        <select value={imageType} onChange={handleImageTypeChange} disabled={isAnalyzing}>
          <option value="skin">Skin photo</option>
          <option value="bone-xray">Bone X-ray (FracAtlas)</option>
        </select>
      </label>

      <label className="image-screening-upload">
        <span className="image-screening-upload-icon" aria-hidden="true">＋</span>
        <span>{image ? 'Choose a different image' : 'Choose an image'}</span>
        <small>
          {imageType === 'skin' ? 'Skin photo' : 'Musculoskeletal bone X-ray'} · JPG, PNG, or WebP · Up to 10 MB
        </small>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={isAnalyzing}
          onChange={handleImageChange}
          aria-label="Choose a medical image"
        />
      </label>

      {error && <p className="image-screening-error" role="alert">{error}</p>}

      {image && (
        <div className="image-screening-preview">
          <img src={previewUrl} alt={`Local preview of ${image.name}`} />
          <div className="image-screening-file">
            <strong>{image.name}</strong>
            <small>{(image.size / (1024 * 1024)).toFixed(2)} MB</small>
          </div>
          <button
            type="button"
            className="image-screening-clear"
            onClick={clearImage}
            disabled={isAnalyzing}
          >
            Remove image
          </button>
        </div>
      )}

      {image && (
        <button
          type="button"
          className="image-screening-analyze"
          onClick={analyzeImage}
          disabled={isAnalyzing}
        >
          {isAnalyzing
            ? 'Screening image…'
            : imageType === 'skin' ? 'Screen skin image' : 'Screen bone X-ray'}
        </button>
      )}

      {result && (
        <div className="image-screening-result" aria-live="polite">
          <h3>{imageType === 'skin' ? 'Top matching skin dataset categories' : 'Bone X-ray screening result'}</h3>
          {imageType === 'bone-xray' && <strong>{result.prediction}</strong>}
          <p>
            This experimental model's ranked matches are not probabilities or diagnoses. On the held-out dataset,
            accuracy was {(result.evaluation.held_out_accuracy * 100).toFixed(1)}% and balanced
            accuracy was {(result.evaluation.held_out_balanced_accuracy * 100).toFixed(1)}%
            {' '}across {result.evaluation.test_samples} images. These figures do not establish
            clinical performance.
          </p>
          {imageType === 'bone-xray' && (
            <>
              <p>
                Held-out sensitivity was {(result.evaluation.held_out_sensitivity * 100).toFixed(1)}%;
                specificity was {(result.evaluation.held_out_specificity * 100).toFixed(1)}%.
              </p>
              <p>
                The dataset’s published split CSVs list fracture-positive images; non-fracture
                controls were randomly assigned across train/validation/test splits. A
                non-fracture-class result does not rule out a fracture.
              </p>
            </>
          )}
          <ol>
            {result.matches.map((match) => (
              <li key={match.category}>
                <span>{match.category.replaceAll('_', ' ')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="image-screening-notice" role="note">
        <strong>Research prototype — not clinically validated and not a diagnosis.</strong>
        <p>
          Skin results use the skin disease dataset; bone X-ray results use FracAtlas, a
          musculoskeletal radiograph dataset (not dental X-rays). Neither classifier has been
          validated for clinical use. Results do not establish that you have or do not have a
          condition. Do not use them to delay medical care or make treatment decisions.
        </p>
      </div>

      <div className="image-screening-guidance">
        <h3>What to do next</h3>
        <ul>
          <li>Ask a qualified healthcare professional to assess the image and your symptoms.</li>
          <li>For a skin concern, note when it started and whether it is changing, painful, or spreading.</li>
          <li>For a suspected fracture, seek assessment from a qualified healthcare professional; do not rely on an image classifier.</li>
          <li>For an image or symptom suggesting an emergency, contact local emergency services now.</li>
        </ul>
      </div>
    </section>
  );
};

export default ImageScreening;
