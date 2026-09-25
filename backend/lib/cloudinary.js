import { v2 as cloudinary } from 'cloudinary';

function isConfigured() {
  return ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every((key) => Boolean(process.env[key]?.trim()));
}

export function uploadProductImage(buffer) {
  if (!isConfigured()) { const error = new Error('Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env.'); error.status = 503; throw error; }
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(), api_key: process.env.CLOUDINARY_API_KEY.trim(), api_secret: process.env.CLOUDINARY_API_SECRET.trim(), secure: true });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'nuvanti/products', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] }, (error, result) => {
      if (error) {
        console.error('[cloudinary] Upload failed. Full error object:', error);
        console.error('[cloudinary] Config in use — cloud_name:', process.env.CLOUDINARY_CLOUD_NAME, '| api_key set:', Boolean(process.env.CLOUDINARY_API_KEY), '| api_secret set:', Boolean(process.env.CLOUDINARY_API_SECRET));
        if (error.http_code === 403 || error.http_code === 401) {
          console.error('[cloudinary] Received an auth-related status code from Cloudinary. Verify that CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are correct and match the same Cloudinary account, and that the API key has not been disabled or regenerated.');
        }
        reject(error);
        return;
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}
