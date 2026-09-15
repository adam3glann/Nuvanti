import { Router } from 'express';
import multer from 'multer';
import { uploadProductImage } from '../lib/cloudinary.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter: (req, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) });
router.post('/product-image', upload.single('image'), async (req, res) => { if (!req.file) return res.status(400).json({ error: 'Upload a JPEG, PNG, WebP, or GIF image under 10 MB.' }); const image = await uploadProductImage(req.file.buffer); res.status(201).json(image); });
export default router;
