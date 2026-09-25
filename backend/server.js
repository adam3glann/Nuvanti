import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import productsRouter from "./routes/products.js";
import categoriesRouter from "./routes/categories.js";
import storefrontRouter from "./routes/storefront.js";
import newsletterRouter from "./routes/newsletter.js";
import ordersRouter from "./routes/orders.js";
import addressesRouter from "./routes/addresses.js";
import contactRouter from "./routes/contact.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import uploadsRouter from "./routes/uploads.js";
import { requireAdminPage, requireAuth, requireRole } from "./lib/auth.js";
import { errorHandler, notFound, sameOrigin } from "./middleware/security.js";
import { query } from "./lib/db.js";
import { emailDeliveryStatus } from "./lib/mail.js";

const app = express();
const STAFF_ROLES = ["staff", "manager", "admin", "super_admin"];
const PORT = Number(process.env.PORT || 4000);
const ADMIN_PORT = Number(process.env.ADMIN_PORT || 4001);
const isProduction = process.env.NODE_ENV === "production";
const railwayOrigin = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : "";

function publicOrigin(name, rawValue, fallback) {
  const raw = String(rawValue || "")
    .trim()
    .replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  if (!raw) return fallback;
  const value =
    isProduction && !/^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? `https://${raw}`
      : raw;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL origin.`);
  }
  if (isProduction && ["localhost", "127.0.0.1"].includes(parsed.hostname))
    return fallback;
  if (isProduction && parsed.protocol === "http:") parsed.protocol = "https:";
  if (isProduction && parsed.protocol !== "https:")
    throw new Error(`${name} must use HTTPS in production.`);
  return parsed.origin;
}

function safePublicOrigin(name, rawValue, fallback) {
  try {
    return publicOrigin(name, rawValue, fallback);
  } catch (error) {
    console.warn(`${error.message} Ignoring ${name} and using ${fallback}.`);
    return fallback;
  }
}

const defaultStoreOrigin = isProduction
  ? "https://nuvanti-shop.pages.dev"
  : "http://localhost:8080";
const storeOrigin = safePublicOrigin(
  "STORE_ORIGIN",
  process.env.STORE_ORIGIN,
  defaultStoreOrigin,
);
const storePreviewOrigin = process.env.STORE_PREVIEW_ORIGIN
  ? safePublicOrigin(
      "STORE_PREVIEW_ORIGIN",
      process.env.STORE_PREVIEW_ORIGIN,
      "",
    )
  : "";
const notYetExposedOrigin = "https://nuvanti-railway-pending.invalid";
const defaultAdminOrigin = isProduction
  ? railwayOrigin || notYetExposedOrigin
  : `http://localhost:${ADMIN_PORT}`;
let adminOrigin = safePublicOrigin(
  "ADMIN_ORIGIN",
  railwayOrigin || process.env.ADMIN_ORIGIN,
  defaultAdminOrigin,
);
if (isProduction && adminOrigin === storeOrigin) {
  console.warn(
    "ADMIN_ORIGIN matches STORE_ORIGIN; using the Railway admin origin fallback.",
  );
  adminOrigin = defaultAdminOrigin;
}
const adminAppUrl = safePublicOrigin(
  "ADMIN_APP_URL",
  railwayOrigin || process.env.ADMIN_APP_URL,
  adminOrigin,
);
const apiPublicUrl = safePublicOrigin(
  "API_PUBLIC_URL",
  railwayOrigin || process.env.API_PUBLIC_URL,
  railwayOrigin || adminOrigin,
);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "../frontend");
const trustProxy = process.env.TRUST_PROXY
  ? Number(process.env.TRUST_PROXY)
  : isProduction
    ? 1
    : 0;
if (!Number.isInteger(trustProxy) || trustProxy < 0)
  throw new Error("TRUST_PROXY must be a non-negative integer.");
if (process.env.NODE_ENV === "production") {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    /replace-with|example|paste_/i.test(process.env.JWT_SECRET)
  ) {
    throw new Error(
      "Set a unique production JWT_SECRET of at least 32 characters.",
    );
  }
  for (const [name, origin] of [
    ["STORE_ORIGIN", storeOrigin],
    ["ADMIN_ORIGIN", adminOrigin],
    ["ADMIN_APP_URL", adminAppUrl],
    ["API_PUBLIC_URL", apiPublicUrl],
  ]) {
    if (new URL(origin).protocol !== "https:")
      throw new Error(`${name} must use HTTPS in production.`);
  }
  if (!emailDeliveryStatus().configured)
    console.warn(
      "Email is not configured; the website will run, but email actions will fail until SMTP or Resend is configured.",
    );
}

app.disable("x-powered-by");
if (trustProxy) app.set("trust proxy", trustProxy);
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(
  cors({
    origin: [storeOrigin, storePreviewOrigin, adminOrigin].filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.use(sameOrigin({ storeOrigin, storePreviewOrigin, adminOrigin }));
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
  authRouter,
);

app.get("/api/health", async (req, res, next) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/storefront", storefrontRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/addresses", addressesRouter);
app.use("/api/contact", contactRouter);
app.use("/api/admin", requireAuth, requireRole(...STAFF_ROLES), adminRouter);
app.use(
  "/api/admin/uploads",
  requireAuth,
  requireRole(...STAFF_ROLES),
  uploadsRouter,
);

app.use(notFound);
app.use(errorHandler);

// A separate, server-protected admin origin: static files are never public.
const adminApp = express();
adminApp.disable("x-powered-by");
adminApp.use(helmet({ contentSecurityPolicy: false }));
adminApp.use(cookieParser());
adminApp.get("/login.html", (req, res) =>
  res.sendFile(path.join(frontendRoot, "admin/login.html")),
);
// Login shell assets are public; admin documents and application assets below
// remain server-authorized. Public JavaScript contains no credentials or data.
adminApp.use(
  "/assets/css",
  express.static(path.join(frontendRoot, "admin/assets/css")),
);
adminApp.use(
  "/assets/js/config.js",
  express.static(path.join(frontendRoot, "admin/assets/js/config.js")),
);
adminApp.use(
  "/assets/js/services/adminAuthService.js",
  express.static(
    path.join(frontendRoot, "admin/assets/js/services/adminAuthService.js"),
  ),
);
adminApp.use(
  "/assets/js/components/icons.js",
  express.static(
    path.join(frontendRoot, "admin/assets/js/components/icons.js"),
  ),
);
adminApp.use(
  "/assets/js/pages/login.js",
  express.static(path.join(frontendRoot, "admin/assets/js/pages/login.js")),
);
adminApp.use(requireAdminPage, requireRole(...STAFF_ROLES));
adminApp.use(
  "/store-assets",
  express.static(path.join(frontendRoot, "assets")),
);
adminApp.use(
  express.static(path.join(frontendRoot, "admin"), {
    index: "index.html",
    fallthrough: false,
  }),
);
adminApp.use((err, req, res, next) =>
  res.status(err.status === 404 ? 404 : 500).send("Not found"),
);
if (trustProxy) adminApp.set("trust proxy", trustProxy);

await query("SELECT 1");
if (process.env.NODE_ENV === "production") {
  // Railway exposes one service port for both the API and protected admin.
  // The storefront is hosted separately; every non-API request to this
  // service goes through the protected admin gateway, except the bare root:
  // it is the public entry point people commonly try, so send it to the store.
  const publicApp = express();
  publicApp.use((req, res, next) => {
    if (req.path === "/") return res.redirect(302, storeOrigin);
    if (!req.path.startsWith("/api/")) return adminApp(req, res, next);
    return app(req, res, next);
  });
  publicApp.listen(PORT, "0.0.0.0", () =>
    console.log(`Nuvanti public service listening on port ${PORT}`),
  );
} else {
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Nuvanti API listening on http://localhost:${PORT}`),
  );
  adminApp.listen(ADMIN_PORT, "0.0.0.0", () =>
    console.log(`Protected admin listening on http://localhost:${ADMIN_PORT}`),
  );
}
