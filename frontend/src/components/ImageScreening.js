import React, { useEffect, useState } from 'react';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ImageScreening = () => {
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

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
  };

  return (
    <section className="glass-panel dashboard-card card-span-2 image-screening-card">
      <div className="panel-row between">
        <div>
          <span className="panel-icon small">🩻</span>
          <strong>Medical Image Review</strong>
        </div>
        <span className="tag">Preview only</span>
      </div>

      <p className="image-screening-intro">
        Select a skin photo or an image exported from a medical scan. You can preview it here,
        but automated disease screening is not available yet.
      </p>

      <label className="image-screening-upload">
        <span className="image-screening-upload-icon" aria-hidden="true">＋</span>
        <span>{image ? 'Choose a different image' : 'Choose an image'}</span>
        <small>JPG, PNG, or WebP · Up to 10 MB</small>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
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
          <button type="button" className="image-screening-clear" onClick={clearImage}>
            Remove image
          </button>
        </div>
      )}

      <div className="image-screening-notice" role="note">
        <strong>This is not a diagnosis.</strong>
        <p>
          This page only displays a local preview. It does not upload or analyze the image,
          identify a disease, or recommend treatment. Do not use it to delay medical care.
        </p>
      </div>

      <div className="image-screening-guidance">
        <h3>What to do next</h3>
        <ul>
          <li>Ask a qualified healthcare professional to assess the image and your symptoms.</li>
          <li>For a skin concern, note when it started and whether it is changing, painful, or spreading.</li>
          <li>For an image or symptom suggesting an emergency, contact local emergency services now.</li>
        </ul>
      </div>
    </section>
  );
};

export default ImageScreening;
