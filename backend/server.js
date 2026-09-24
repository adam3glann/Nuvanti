import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import express from 'express';
import serverless from 'serverless-http';
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
const storePreviewOrigin = process.env.STORE_PREVIEW_ORIGIN || '';
const adminOrigin = process.env.ADMIN_ORIGIN || `http://localhost:${ADMIN_PORT}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = process.env.NUVANTI_NETLIFY_FUNCTION === 'true'
  ? [path.resolve(process.cwd(), 'frontend'), path.resolve(process.cwd(), '../frontend')].find((candidate) => existsSync(candidate)) || path.resolve(process.cwd(), 'frontend')
  : path.resolve(__dirname, '../frontend');
const trustProxy = process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0;
export let handler;
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
  if (storePreviewOrigin) {
    try { if (new URL(storePreviewOrigin).protocol !== 'https:') throw new Error(); }
    catch { throw new Error('STORE_PREVIEW_ORIGIN must be an absolute HTTPS URL in production.'); }
  }
  try { if (new URL(process.env.API_PUBLIC_URL || '').protocol !== 'https:') throw new Error(); }
  catch { throw new Error('API_PUBLIC_URL must be the public HTTPS origin of the API in production.'); }
  if (storeOrigin === adminOrigin) throw new Error('STORE_ORIGIN and ADMIN_ORIGIN must be separate production hosts.');
  const mailFrom = process.env.MAIL_FROM && !/example|paste_/i.test(process.env.MAIL_FROM);
  const resendReady = process.env.RESEND_API_KEY && mailFrom;
  const smtpReady = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].every((name) => process.env[name] && !/example|paste_/i.test(process.env[name])) && mailFrom;
  if (!resendReady && !smtpReady) {
    throw new Error('Configure RESEND_API_KEY and MAIL_FROM, or SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM, before starting.');
  }
}

app.disable('x-powered-by');
if (trustProxy) app.set('trust proxy', trustProxy);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: [storeOrigin, storePreviewOrigin, adminOrigin].filter(Boolean), credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(sameOrigin({ storeOrigin, storePreviewOrigin, adminOrigin }));
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
adminApp.get('/login.html', (req, res) => res.sendFile(path.join(frontendRoot, 'admin/login.html')));
// Login shell assets are public; admin documents and application assets below
// remain server-authorized. Public JavaScript contains no credentials or data.
adminApp.use('/assets/css', express.static(path.join(frontendRoot, 'admin/assets/css')));
adminApp.use('/assets/js/config.js', express.static(path.join(frontendRoot, 'admin/assets/js/config.js')));
adminApp.use('/assets/js/services/adminAuthService.js', express.static(path.join(frontendRoot, 'admin/assets/js/services/adminAuthService.js')));
adminApp.use('/assets/js/components/icons.js', express.static(path.join(frontendRoot, 'admin/assets/js/components/icons.js')));
adminApp.use('/assets/js/pages/login.js', express.static(path.join(frontendRoot, 'admin/assets/js/pages/login.js')));
adminApp.use(requireAdminPage, requireRole(...STAFF_ROLES));
adminApp.use('/store-assets', express.static(path.join(frontendRoot, 'assets')));
adminApp.use(express.static(path.join(frontendRoot, 'admin'), { index: 'index.html', fallthrough: false }));
adminApp.use((err, req, res, next) => res.status(err.status === 404 ? 404 : 500).send('Not found'));
if (trustProxy) adminApp.set('trust proxy', trustProxy);

const isNetlify = process.env.NUVANTI_NETLIFY_FUNCTION === 'true';
// Do not wait on PostgreSQL while a Netlify function is cold-starting. A
// transient database connection delay must not prevent the function from
// loading and serving the admin shell or returning an API error response.
if (!isNetlify) await query('SELECT 1');
if (process.env.NODE_ENV === 'production') {
  // PaaS web services expose one port. Route the admin hostname to its
  // protected gateway and all other hosts to the API on that same listener.
  const adminHostname = new URL(adminOrigin).hostname.toLowerCase();
  const publicApp = express();
  publicApp.use((req, res, next) => {
    const isAdminHost = (req.hostname || '').toLowerCase() === adminHostname;
    if (isAdminHost && !req.path.startsWith('/api/')) return adminApp(req, res, next);
    return app(req, res, next);
  });
  if (isNetlify) {
    // Netlify forwards both the API host and the separate admin host through
    // one serverless function. Keep the admin hostname behind its own gate.
    handler = serverless(publicApp);
  } else {
    publicApp.listen(PORT, '0.0.0.0', () => console.log(`Nuvanti public service listening on port ${PORT}`));
  }
} else {
  app.listen(PORT, '0.0.0.0', () => console.log(`Nuvanti API listening on http://localhost:${PORT}`));
  adminApp.listen(ADMIN_PORT, '0.0.0.0', () => console.log(`Protected admin listening on http://localhost:${ADMIN_PORT}`));
}
