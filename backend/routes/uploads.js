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
    next(error);
  }
});
export default router;
