import { Router } from 'express';
import { readJSON } from '../lib/store.js';

const router = Router();

// GET /api/products?category=polos&collection=mens&search=polo
router.get('/', async (req, res) => {
  const products = await readJSON('products');
  const { category, collection, search } = req.query;

  let list = products;
  if (category) list = list.filter((p) => p.category === category);
  if (collection) list = list.filter((p) => p.collection === collection);
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  res.json(list);
});

// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  const products = await readJSON('products');
  const product = products.find((p) => p.slug === req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// GET /api/products/:slug/related?limit=4
router.get('/:slug/related', async (req, res) => {
  const products = await readJSON('products');
  const product = products.find((p) => p.slug === req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const limit = Number(req.query.limit) || 4;
  const related = products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, limit);
  res.json(related);
});

export default router;
