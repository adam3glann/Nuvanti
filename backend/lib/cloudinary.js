import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

function isConfigured() {
  return ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every((key) => Boolean(process.env[key]));
}

export function uploadProductImage(buffer) {
  if (!isConfigured()) { const error = new Error('Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env.'); error.status = 503; throw error; }
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'nuvanti/products', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] }, (error, result) => error ? reject(error) : resolve({ url: result.secure_url, publicId: result.public_id }));
    Readable.from(buffer).pipe(stream);
  });
}
