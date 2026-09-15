import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import ordersRouter from './routes/orders.js';
import contactRouter from './routes/contact.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import uploadsRouter from './routes/uploads.js';
import { requireAuth, requireRole } from './lib/auth.js';
import { errorHandler, notFound, sameOrigin } from './middleware/security.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const ADMIN_PORT = Number(process.env.ADMIN_PORT || 4001);
const storeOrigin = process.env.STORE_ORIGIN || 'http://localhost:8080';
const adminOrigin = process.env.ADMIN_ORIGIN || `http://localhost:${ADMIN_PORT}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: [storeOrigin, adminOrigin], credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }), authRouter);
app.use(sameOrigin({ storeOrigin, adminOrigin }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin', requireAuth, requireRole('admin', 'super_admin'), adminRouter);
app.use('/api/admin/uploads', requireAuth, requireRole('admin', 'super_admin'), uploadsRouter);

app.use(notFound);
app.use(errorHandler);

// A separate, server-protected admin origin: static files are never public.
const adminApp = express();
adminApp.disable('x-powered-by');
adminApp.use(helmet({ contentSecurityPolicy: false }));
adminApp.use(cookieParser());
adminApp.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend/admin/login.html')));
// Login shell assets are public; admin documents and application assets below
// remain server-authorized. Public JavaScript contains no credentials or data.
adminApp.use('/assets/css', express.static(path.join(__dirname, '../frontend/admin/assets/css')));
adminApp.use('/assets/js/services/adminAuthService.js', express.static(path.join(__dirname, '../frontend/admin/assets/js/services/adminAuthService.js')));
adminApp.use('/assets/js/components/icons.js', express.static(path.join(__dirname, '../frontend/admin/assets/js/components/icons.js')));
adminApp.use('/assets/js/pages/login.js', express.static(path.join(__dirname, '../frontend/admin/assets/js/pages/login.js')));
adminApp.use(requireAuth, requireRole('admin', 'super_admin'));
adminApp.use(express.static(path.join(__dirname, '../frontend/admin'), { index: 'index.html', fallthrough: false }));
adminApp.use((err, req, res, next) => res.status(err.status === 404 ? 404 : 500).send('Not found'));
app.listen(PORT, () => console.log(`Nuvanti API listening on http://localhost:${PORT}`));
adminApp.listen(ADMIN_PORT, () => console.log(`Protected admin listening on http://localhost:${ADMIN_PORT}`));
