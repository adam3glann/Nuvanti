import { Router } from 'express';
import { readJSON } from '../lib/store.js';

const router = Router();

router.get('/', async (req, res) => {
  const data = await readJSON('categories');
  res.json(data);
});

export default router;
