import { v2 as cloudinary } from 'cloudinary';

function isConfigured() {
  return ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every((key) => Boolean(process.env[key]?.trim()));
}

function uploadImage(buffer, folder) {
  if (!isConfigured()) { const error = new Error('Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env.'); error.status = 503; throw error; }
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(), api_key: process.env.CLOUDINARY_API_KEY.trim(), api_secret: process.env.CLOUDINARY_API_SECRET.trim(), secure: true });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] }, (error, result) => {
      if (error) {
        console.error('[cloudinary] Upload failed:', {
          name: error?.name,
          code: error?.code,
          httpCode: error?.http_code,
          message: String(error?.message || 'Unknown upload error').slice(0, 300),
        });
        reject(error);
        return;
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}

export const uploadProductImage = (buffer) => uploadImage(buffer, 'nuvanti/products');
export const uploadCategoryImage = (buffer) => uploadImage(buffer, 'nuvanti/categories');
