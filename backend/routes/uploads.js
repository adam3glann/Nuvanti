import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { uploadProductImage } from '../lib/cloudinary.js';

const router = Router();
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, parts: 6 },
  fileFilter: (req, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

function hasSupportedImageSignature(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;
  return buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6));
}

router.post('/product-image', uploadLimiter, (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Images must be 5 MB or smaller.' });
    return res.status(400).json({ error: 'Upload a valid JPEG, PNG, WebP, or GIF image.' });
  });
}, async (req, res, next) => {
  try {
    if (!req.file || !hasSupportedImageSignature(req.file.buffer)) {
      return res.status(400).json({ error: 'Upload a valid JPEG, PNG, WebP, or GIF image under 5 MB.' });
    }
    const image = await uploadProductImage(req.file.buffer);
    res.status(201).json(image);
  } catch (error) {
    // Cloudinary SDK errors otherwise become an unhelpful generic 500. Log
    // provider details server-side (never the API credentials) and return a
    // specific, safe action the admin can take.
    console.error('Cloudinary image upload failed:', {
      name: error.name,
      code: error.code,
      httpCode: error.http_code || error.status,
      message: error.message,
    });
    const providerStatus = Number(error.http_code || error.status);
    const networkFailure = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(error.code);
    if (error.status === 503 && /Cloudinary is not configured/i.test(error.message || '')) {
      return res.status(503).json({ error: error.message });
    }
    if (networkFailure) {
      return res.status(502).json({ error: 'Railway could not connect to Cloudinary. Check the backend service outbound network/egress settings and retry.' });
    }
    if (providerStatus === 401) {
      return res.status(502).json({ error: 'Cloudinary rejected its credentials. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in this Railway backend service.' });
    }
    if (providerStatus === 403) {
      return res.status(502).json({ error: 'Cloudinary refused the upload. Check the Cloudinary account status, upload quota, and API key permissions.' });
    }
    if (providerStatus === 400) {
      return res.status(400).json({ error: 'Cloudinary rejected this image or its upload settings. Use a JPEG, PNG, WebP, or GIF under 5 MB and check the Cloudinary account settings.' });
    }
    return res.status(502).json({ error: 'Cloudinary upload failed. Check the Railway backend logs for the provider error.' });
  }
});
export default router;
