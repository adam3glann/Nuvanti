// cartService — local-state cart, structured so `add/remove/updateQty`
// can later dispatch to a Node API (POST /cart, PATCH /cart/:lineId, etc.)
// instead of writing to localStorage.
import { API_ORIGIN as API } from "../config.js";
const STORAGE_KEY = "nuvanti_cart_v1";
const ACCOUNT_KEY = "nuvanti_cart_account_v1";
let FREE_SHIPPING_THRESHOLD = 3000;

export function configureFreeShippingThreshold(value) {
  if (Number.isFinite(value) && value >= 0) FREE_SHIPPING_THRESHOLD = value;
}

let listeners = [];
let latestCatalog = new Map();
let accountCartReady = false;
let pendingAccountSync = null;
let accountPoll = null;
let applyRemoteCart = false;
let accountInitialization = null;
let accountGeneration = 0;

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(value)) return [];
    return value.map(normalizeLine).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeLine(line) {
  if (!line || typeof line !== "object") return null;
  const productId = Number(line.productId);
  const quantity = Number(line.quantity);
  const price = Number(line.price);
  if (
    !Number.isSafeInteger(productId) ||
    productId < 1 ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1
  )
    return null;
  const size = String(line.size || "One Size").slice(0, 20);
  const color = String(line.color || "Default").slice(0, 60);
  const bundleSelection = line.bundleSelection && typeof line.bundleSelection === "object" ? line.bundleSelection : null;
  const lineId = bundleSelection ? JSON.stringify([productId, bundleSelection]) : JSON.stringify([productId, size, color]);
  const image = String(line.image || "");
  const safeImage =
    /^https:\/\//i.test(image) ||
    (/^\/?assets\/[\w./-]+(?:\?[\w%=&.-]*)?$/.test(image) &&
      !image.includes(".."));
  return {
    lineId,
    productId,
    slug: String(line.slug || "").slice(0, 160),
    name: String(line.name || "Nuvanti item").slice(0, 160),
    image: safeImage
      ? image.slice(0, 500)
      : "assets/img/brand/nuvanti-logo.png",
    price,
    size,
    color,
    ...(bundleSelection ? { bundleSelection } : {}),
    quantity: Math.min(quantity, 10),
  };
}
function write(lines) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* Keep this tab's UI responsive if browser storage is unavailable. */
  }
  listeners.forEach((fn) => fn(lines));
  if (accountCartReady && !applyRemoteCart) {
    clearTimeout(pendingAccountSync);
    pendingAccountSync = setTimeout(() => saveAccountCart(lines), 450);
  }
}

async function fetchAccountCart() {
  const response = await fetch(`${API}/api/cart`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error("Account cart unavailable");
  return await response.json();
}

async function saveAccountCart(lines) {
  try {
    const response = await fetch(`${API}/api/cart`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: lines }) });
    if (response.status === 401) accountCartReady = false;
  } catch { /* Local cart remains usable; next page load will retry. */ }
}

export function initializeAccountCart() {
  if (accountInitialization) return accountInitialization;
  accountInitialization = initializeAccountCartOnce().finally(() => { accountInitialization = null; });
  return accountInitialization;
}

async function initializeAccountCartOnce() {
  const generation = accountGeneration;
  try {
    const remoteData = await fetchAccountCart();
    if (generation !== accountGeneration) return false;
    const remote = remoteData.items || [];
    const local = read();
    const byId = new Map(remote.map(item => [normalizeLine(item)?.lineId, normalizeLine(item)]).filter(([id, item]) => id && item));
    let priorAccount = ""; try { priorAccount = localStorage.getItem(ACCOUNT_KEY) || ""; } catch {}
    for (const raw of (!priorAccount ? local : [])) {
      const item = normalizeLine(raw); if (!item) continue;
      const prior = byId.get(item.lineId);
      if (prior) prior.quantity = Math.min(10, prior.quantity + item.quantity);
      else byId.set(item.lineId, item);
    }
    const merged = [...byId.values()].slice(0, 30);
    try { localStorage.setItem(ACCOUNT_KEY, String(remoteData.userId)); } catch {}
    applyRemoteCart = true; write(merged); applyRemoteCart = false;
    accountCartReady = true;
    await saveAccountCart(merged);
    clearInterval(accountPoll);
    accountPoll = setInterval(async () => {
      if (!accountCartReady || generation !== accountGeneration || document.visibilityState === "hidden" || pendingAccountSync) return;
      try {
        const current = await fetchAccountCart();
        const normalized = (current.items || []).map(normalizeLine).filter(Boolean).slice(0,30);
        if (JSON.stringify(normalized) !== JSON.stringify(read())) {
          applyRemoteCart = true; write(normalized); applyRemoteCart = false;
        }
      } catch { accountCartReady = false; clearInterval(accountPoll); }
    }, 15000);
    return true;
  } catch {
    accountCartReady = false;
    return false;
  }
}

export function disconnectAccountCart({ clearLocal = false } = {}) {
  accountGeneration += 1; accountCartReady = false; clearTimeout(pendingAccountSync); clearInterval(accountPoll);
  if (clearLocal) { try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(ACCOUNT_KEY); } catch {} listeners.forEach(fn => fn([])); }
}

export function onCartChange(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getCart() {
  return read();
}

export function syncCartWithProducts(products) {
  const catalog = new Map(
    (products || [])
      .filter(Boolean)
      .map((product) => [String(product.id), product]),
  );
  latestCatalog = catalog;
  const removed = [];
  const adjusted = [];
  let priceChanged = false;
  let bundleColorsAdjusted = false;
  const remainingByVariant = new Map();
  const lines = read().flatMap((line) => {
    const product = catalog.get(String(line.productId));
    if (!product) {
      removed.push(line.name);
      return [];
    }
    if (line.bundleSelection) {
      const b = product.bundle;
      const c = line.bundleSelection.crewneck, s = line.bundleSelection.sweatpants;
      if (!b?.crewneck || !b?.sweatpants || !c || !s) { removed.push(line.name); return []; }
      const stockFor = (p, v) => Number(p.inventoryByVariant?.[`${v.color}::${v.size}`] ?? p.inventory?.[v.size] ?? 0);
      const crewneckColors = b.crewneck.colors?.length ? b.crewneck.colors : ["Default"];
      const sweatpantsColors = b.sweatpants.colors?.length ? b.sweatpants.colors : ["Default"];
      const commonColors = crewneckColors.flatMap((color) => {
        const matching = sweatpantsColors.find((candidate) => candidate.trim().toLowerCase() === color.trim().toLowerCase());
        return matching ? [{ crewneck: color, sweatpants: matching }] : [];
      });
      let matchingColor = commonColors.find(({ crewneck, sweatpants }) => crewneck.trim().toLowerCase() === c.color.trim().toLowerCase() && sweatpants.trim().toLowerCase() === s.color.trim().toLowerCase());
      if (!matchingColor) matchingColor = commonColors.find(({ crewneck, sweatpants }) => stockFor(b.crewneck, { color: crewneck, size: c.size }) > 0 && stockFor(b.sweatpants, { color: sweatpants, size: s.size }) > 0);
      if (!matchingColor) { removed.push(line.name); return []; }
      if (c.color !== matchingColor.crewneck || s.color !== matchingColor.sweatpants) {
        line.bundleSelection = { crewneck: { ...c, color: matchingColor.crewneck }, sweatpants: { ...s, color: matchingColor.sweatpants } };
        line.lineId = JSON.stringify([Number(line.productId), line.bundleSelection]);
        bundleColorsAdjusted = true;
      }
      const selection = line.bundleSelection;
      const available = Math.min(stockFor(b.crewneck, selection.crewneck), stockFor(b.sweatpants, selection.sweatpants));
      if (available <= 0) { removed.push(line.name); return []; }
      line.quantity = Math.min(line.quantity, available, 10);
      line.price = Number(product.price);
      line.name = product.name || line.name;
      line.image = product.images?.[0] || line.image;
      return [line];
    }
    if (
      (product.sizes?.length && !product.sizes.includes(line.size)) ||
      (product.colors?.length && !product.colors.includes(line.color))
    ) {
      removed.push(line.name);
      return [];
    }
    const stock = Number(
      product.inventoryByVariant?.[`${line.color}::${line.size}`] ??
        product.inventory?.[line.size] ??
        product.inventory?.["One Size"] ??
        0,
    );
    if (!Number.isFinite(stock) || stock <= 0) {
      removed.push(line.name);
      return [];
    }
    const variantKey = JSON.stringify([line.productId, line.color, line.size]);
    const remaining = remainingByVariant.has(variantKey)
      ? remainingByVariant.get(variantKey)
      : Math.floor(stock);
    const allowed = Math.min(10, remaining);
    if (line.quantity > allowed) {
      adjusted.push(line.name);
      line.quantity = allowed;
    }
    remainingByVariant.set(variantKey, remaining - line.quantity);
    if (line.quantity <= 0) {
      removed.push(line.name);
      return [];
    }
    const nextPrice = Number(product.price);
    if (Number.isFinite(nextPrice) && nextPrice !== line.price)
      priceChanged = true;
    line.price = Number.isFinite(nextPrice) ? nextPrice : line.price;
    line.name = product.name || line.name;
    line.image = product.images?.[0] || line.image;
    return [line];
  });
  if (removed.length || adjusted.length || priceChanged || bundleColorsAdjusted) write(lines);
  return { removed, adjusted, priceChanged };
}

// Stock is tracked per size (shared across colors). The server remains the
// source of truth; this helper uses the latest catalog loaded by cart/checkout
// pages to keep local controls within the current known stock.
export function variantStockRemaining(product, size, color = "Default") {
  const productId = String(product?.id || "");
  const stockProduct = product || latestCatalog.get(productId);
  const stock = Math.max(
    0,
    Math.floor(
      Number(
        stockProduct?.inventoryByVariant?.[`${color}::${size}`] ??
          stockProduct?.inventory?.[size] ??
          stockProduct?.inventory?.["One Size"] ??
          0,
      ),
    ),
  );
  const inBag = read()
    .filter(
      (line) =>
        String(line.productId) === productId &&
        line.size === size &&
        line.color === color,
    )
    .reduce((sum, line) => sum + line.quantity, 0);
  return Math.max(0, stock - inBag);
}

export function variantStock(productId, size, color = "Default") {
  const product = latestCatalog.get(String(productId));
  if (!product) return null;
  const stock = Number(
    product.inventoryByVariant?.[`${color}::${size}`] ??
      product.inventory?.[size] ??
      product.inventory?.["One Size"] ??
      0,
  );
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
}

export function canIncreaseQuantity(lineId) {
  const lines = read();
  const line = lines.find((item) => item.lineId === lineId);
  if (!line) return false;
  const product = latestCatalog.get(String(line.productId));
  if (!product) return line.quantity < 10;
  if (line.bundleSelection) {
    const selection = line.bundleSelection;
    const stock = (part, v) => Number(part?.inventoryByVariant?.[`${v.color}::${v.size}`] ?? part?.inventory?.[v.size] ?? 0);
    const available = Math.min(stock(product.bundle?.crewneck, selection.crewneck), stock(product.bundle?.sweatpants, selection.sweatpants));
    return line.quantity < Math.min(10, available);
  }
  const stock = Math.floor(
    Number(
      product.inventoryByVariant?.[`${line.color}::${line.size}`] ??
        product.inventory?.[line.size] ??
        product.inventory?.["One Size"] ??
        0,
    ),
  );
  const totalInBag = lines
    .filter(
      (item) =>
        item.productId === line.productId &&
        item.size === line.size &&
        item.color === line.color,
    )
    .reduce((sum, item) => sum + item.quantity, 0);
  return line.quantity < 10 && totalInBag < stock;
}

export function addToCart({ product, size, color, quantity = 1 }) {
  if (
    !product ||
    !Number.isSafeInteger(Number(product.id)) ||
    Number(product.id) < 1
  )
    return read();
  const lines = read();
  const safeSize = String(size || "One Size").slice(0, 20);
  const safeColor = String(color || "Default").slice(0, 60);
  const lineId = JSON.stringify([Number(product.id), safeSize, safeColor]);
  const existing = lines.find((l) => l.lineId === lineId);
  const stock = Math.max(
    0,
    Math.floor(
      Number(
        product.inventoryByVariant?.[`${safeColor}::${safeSize}`] ??
          product.inventory?.[safeSize] ??
          product.inventory?.["One Size"] ??
          0,
      ),
    ),
  );
  const inBagForSize = lines
    .filter(
      (line) =>
        line.productId === Number(product.id) &&
        line.size === safeSize &&
        line.color === safeColor,
    )
    .reduce((sum, line) => sum + line.quantity, 0);
  const remaining = Math.max(0, stock - inBagForSize);
  if (remaining <= 0) return lines;
  const toAdd = Math.min(
    10,
    remaining,
    Math.max(1, Math.floor(Number(quantity) || 1)),
  );
  if (existing) {
    existing.quantity = Math.min(10, existing.quantity + toAdd);
  } else {
    lines.push({
      lineId,
      productId: Number(product.id),
      slug: product.slug,
      name: product.name,
      image: product.colorImages?.[safeColor]?.[0] || product.images?.[0],
      price: Number(product.price),
      size: safeSize,
      color: safeColor,
      quantity: toAdd,
    });
  }
  const normalized = lines.map(normalizeLine).filter(Boolean);
  write(normalized);
  return normalized;
}

export function addBundleToCart({ product, crewneck, sweatpants, quantity = 1 }) {
  if (!product?.bundle || !crewneck?.size || !sweatpants?.size) return read();
  if (String(crewneck.color || "Default").trim().toLowerCase() !== String(sweatpants.color || "Default").trim().toLowerCase()) return read();
  const bundleSelection = { crewneck: { size: crewneck.size, color: crewneck.color || "Default" }, sweatpants: { size: sweatpants.size, color: sweatpants.color || "Default" } };
  const lineId = JSON.stringify([Number(product.id), bundleSelection]);
  const lines = read();
  const stock = (item, v) => Math.max(0, Math.floor(Number(item.inventoryByVariant?.[`${v.color}::${v.size}`] ?? item.inventory?.[v.size] ?? 0)));
  const remaining = Math.min(stock(product.bundle.crewneck, bundleSelection.crewneck), stock(product.bundle.sweatpants, bundleSelection.sweatpants));
  const existing = lines.find(line => line.lineId === lineId);
  const add = Math.min(10, remaining - lines.filter(l => l.lineId === lineId).reduce((n,l) => n+l.quantity,0), Math.max(1, Math.floor(Number(quantity)||1)));
  if (add <= 0) return lines;
  if (existing) existing.quantity += add;
  else lines.push({ lineId, productId: Number(product.id), slug: product.slug, name: product.name, image: product.images?.[0], price: Number(product.price), size: "Set", color: "Set", bundleSelection, quantity: add });
  const normalized = lines.map(normalizeLine).filter(Boolean); write(normalized); return normalized;
}

export function updateQuantity(lineId, quantity) {
  let lines = read();
  if (quantity <= 0) {
    lines = lines.filter((l) => l.lineId !== lineId);
  } else {
    const target = lines.find((line) => line.lineId === lineId);
    if (!target) return lines;
    const product = latestCatalog.get(String(target?.productId));
    if (target.bundleSelection) {
      const s = target.bundleSelection;
      const stock = (part, v) => Number(part?.inventoryByVariant?.[`${v.color}::${v.size}`] ?? part?.inventory?.[v.size] ?? 0);
      const max = product ? Math.min(stock(product.bundle?.crewneck, s.crewneck), stock(product.bundle?.sweatpants, s.sweatpants)) : 10;
      lines = lines.flatMap(line => line.lineId !== lineId ? [line] : max > 0 ? [{ ...line, quantity: Math.min(10, max, Math.floor(quantity)) }] : []);
      write(lines); return lines;
    }
    const stock = product
      ? Math.floor(
          Number(
            product.inventoryByVariant?.[`${target.color}::${target.size}`] ??
              product.inventory?.[target.size] ??
              product.inventory?.["One Size"] ??
              0,
          ),
        )
      : 10;
    const otherLines = lines
      .filter(
        (line) =>
          line.lineId !== lineId &&
          line.productId === target?.productId &&
          line.size === target?.size &&
          line.color === target?.color,
      )
      .reduce((sum, line) => sum + line.quantity, 0);
    const allowed = Math.max(0, Math.min(10, stock - otherLines));
    lines = lines.flatMap((line) =>
      line.lineId !== lineId
        ? [line]
        : allowed > 0
          ? [{ ...line, quantity: Math.min(allowed, Math.floor(quantity)) }]
          : [],
    );
  }
  write(lines);
  return lines;
}

export function removeFromCart(lineId) {
  const lines = read().filter((l) => l.lineId !== lineId);
  write(lines);
  return lines;
}

export function clearCart() {
  write([]);
}

export function cartSubtotal() {
  return read().reduce((sum, l) => sum + l.price * l.quantity, 0);
}

export function cartCount() {
  return read().reduce((sum, l) => sum + l.quantity, 0);
}

export function amountToFreeShipping() {
  return Math.max(0, FREE_SHIPPING_THRESHOLD - cartSubtotal());
}

export function freeShippingProgress() {
  if (FREE_SHIPPING_THRESHOLD <= 0) return 100;
  return Math.min(
    100,
    Math.round((cartSubtotal() / FREE_SHIPPING_THRESHOLD) * 100),
  );
}

export { FREE_SHIPPING_THRESHOLD };
