import 'dotenv/config';
import { request as httpRequest } from 'node:http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import storefrontRouter from './routes/storefront.js';
import newsletterRouter from './routes/newsletter.js';
import ordersRouter from './routes/orders.js';
import addressesRouter from './routes/addresses.js';
import contactRouter from './routes/contact.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import uploadsRouter from './routes/uploads.js';
import { requireAdminPage, requireAuth, requireRole } from './lib/auth.js';
import { errorHandler, notFound, sameOrigin } from './middleware/security.js';
import { query } from './lib/db.js';

const app = express();
const STAFF_ROLES = ['staff', 'manager', 'admin', 'super_admin'];
const PORT = Number(process.env.PORT || 4000);
const ADMIN_PORT = Number(process.env.ADMIN_PORT || 4001);
const storeOrigin = process.env.STORE_ORIGIN || 'http://localhost:8080';
const adminOrigin = process.env.ADMIN_ORIGIN || `http://localhost:${ADMIN_PORT}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trustProxy = process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0;
if (!Number.isInteger(trustProxy) || trustProxy < 0) throw new Error('TRUST_PROXY must be a non-negative integer.');
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /replace-with|example|paste_/i.test(process.env.JWT_SECRET)) {
    throw new Error('Set a unique production JWT_SECRET of at least 32 characters.');
  }
  for (const [name, origin] of [['STORE_ORIGIN', storeOrigin], ['ADMIN_ORIGIN', adminOrigin], ['ADMIN_APP_URL', process.env.ADMIN_APP_URL || '']]) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error(`${name} must be an absolute HTTPS URL in production.`); }
    if (parsed.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production.`);
  }
  try { if (new URL(process.env.API_PUBLIC_URL || '').protocol !== 'https:') throw new Error(); }
  catch { throw new Error('API_PUBLIC_URL must be the public HTTPS origin of the API in production.'); }
  if (storeOrigin === adminOrigin) throw new Error('STORE_ORIGIN and ADMIN_ORIGIN must be separate production hosts.');
  if (!['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'].every((name) => process.env[name] && !/example|paste_/i.test(process.env[name]))) {
    throw new Error('Configure production SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM before starting.');
  }
}

app.disable('x-powered-by');
if (trustProxy) app.set('trust proxy', trustProxy);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: [storeOrigin, adminOrigin], credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(sameOrigin({ storeOrigin, adminOrigin }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }), authRouter);

app.get('/api/health', async (req, res, next) => {
  try { await query('SELECT 1'); res.json({ ok: true }); }
  catch (error) { next(error); }
});
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/storefront', storefrontRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/addresses', addressesRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin', requireAuth, requireRole(...STAFF_ROLES), adminRouter);
app.use('/api/admin/uploads', requireAuth, requireRole(...STAFF_ROLES), uploadsRouter);

app.use(notFound);
app.use(errorHandler);

// A separate, server-protected admin origin: static files are never public.
const adminApp = express();
adminApp.disable('x-powered-by');
adminApp.use(helmet({ contentSecurityPolicy: false }));
adminApp.use(cookieParser());
adminApp.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend/admin/login.html')));
// Same-origin admin API proxy; the API server still enforces auth and origin checks.
adminApp.use('/api', (req, res) => {
  const upstream = httpRequest({
    hostname: '127.0.0.1',
    port: PORT,
    path: req.originalUrl,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${PORT}` },
  }, (apiRes) => {
    res.writeHead(apiRes.statusCode || 502, apiRes.headers);
    apiRes.pipe(res);
  });
  upstream.on('error', (error) => {
    console.error('Admin API proxy error:', error.message);
    if (!res.headersSent) res.status(502).json({ error: 'Secure API is unavailable.' });
    else res.destroy(error);
  });
  req.pipe(upstream);
});
// Login shell assets are public; admin documents and application assets below
// remain server-authorized. Public JavaScript contains no credentials or data.
adminApp.use('/assets/css', express.static(path.join(__dirname, '../frontend/admin/assets/css')));
adminApp.use('/assets/js/config.js', express.static(path.join(__dirname, '../frontend/admin/assets/js/config.js')));
adminApp.use('/assets/js/services/adminAuthService.js', express.static(path.join(__dirname, '../frontend/admin/assets/js/services/adminAuthService.js')));
adminApp.use('/assets/js/components/icons.js', express.static(path.join(__dirname, '../frontend/admin/assets/js/components/icons.js')));
adminApp.use('/assets/js/pages/login.js', express.static(path.join(__dirname, '../frontend/admin/assets/js/pages/login.js')));
adminApp.use(requireAdminPage, requireRole(...STAFF_ROLES));
adminApp.use('/store-assets', express.static(path.join(__dirname, '../frontend/assets')));
adminApp.use(express.static(path.join(__dirname, '../frontend/admin'), { index: 'index.html', fallthrough: false }));
adminApp.use((err, req, res, next) => res.status(err.status === 404 ? 404 : 500).send('Not found'));
if (trustProxy) adminApp.set('trust proxy', trustProxy);

await query('SELECT 1');
app.listen(PORT, () => console.log(`Nuvanti API listening on http://localhost:${PORT}`));
adminApp.listen(ADMIN_PORT, () => console.log(`Protected admin listening on http://localhost:${ADMIN_PORT}`));
