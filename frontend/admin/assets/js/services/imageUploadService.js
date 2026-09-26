import { API_ORIGIN } from '../config.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 24 * 1024 * 1024;
const MAX_EDGE = 2200;

/** Uploads an image with client-side optimization and real transfer progress. */
export async function uploadAdminImage(file, { endpoint, onProgress } = {}) {
  if (!(file instanceof File)) throw new Error('Choose an image to upload.');
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF image.');
  }
  if (file.size > MAX_SOURCE_BYTES) throw new Error('This image is too large to process. Choose an image under 24 MB.');

  const optimized = await optimizeImage(file, (percent) => onProgress?.({ phase: 'optimizing', percent }));
  if (optimized.size > MAX_UPLOAD_BYTES) {
    throw new Error('Image is still over 5 MB after optimization. Choose a smaller image.');
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_ORIGIN}${endpoint}`);
    xhr.withCredentials = true;
    xhr.timeout = 90_000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.({ phase: 'uploading', percent: Math.round(event.loaded / event.total * 100) });
    };
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText || '{}'); } catch {}
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(body.error || `Image upload failed (HTTP ${xhr.status}).`));
        return;
      }
      if (!body.url) {
        reject(new Error('Upload completed, but the image URL was missing. Please try again.'));
        return;
      }
      resolve(body);
    };
    xhr.onerror = () => reject(new Error('Could not reach the image upload service. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Image upload timed out. Check your connection and try again.'));
    xhr.onabort = () => reject(new Error('Image upload was cancelled.'));
    const form = new FormData();
    form.append('image', optimized, optimized.name || file.name);
    xhr.send(form);
  });
}

async function optimizeImage(file, onProgress) {
  // Keep small assets and animated GIFs byte-for-byte; transcoding a GIF would
  // discard its animation. Compress only when it materially helps uploads.
  if (file.type === 'image/gif' || file.size <= 1_200_000) return file;
  if (!('createImageBitmap' in window)) return file;

  onProgress?.(0);
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { return file; }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    let blob;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, width, height);
      onProgress?.(100);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    } catch { return file; }
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } finally {
    bitmap.close?.();
  }
}
