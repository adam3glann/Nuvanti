// cartService — local-state cart, structured so `add/remove/updateQty`
// can later dispatch to a Node API (POST /cart, PATCH /cart/:lineId, etc.)
// instead of writing to localStorage.
const STORAGE_KEY = 'nuvanti_cart_v1';
let FREE_SHIPPING_THRESHOLD = 3000;

export function configureFreeShippingThreshold(value) {
  if (Number.isFinite(value) && value >= 0) FREE_SHIPPING_THRESHOLD = value;
}

let listeners = [];
let latestCatalog = new Map();

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
  if (!line || typeof line !== 'object') return null;
  const productId = Number(line.productId);
  const quantity = Number(line.quantity);
  const price = Number(line.price);
  if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isFinite(price) || price < 0
      || !Number.isInteger(quantity) || quantity < 1) return null;
  const size = String(line.size || 'One Size').slice(0, 20);
  const color = String(line.color || 'Default').slice(0, 60);
  const image = String(line.image || '');
  const safeImage = /^https:\/\//i.test(image) || /^\/?assets\/[\w./-]+(?:\?[\w%=&.-]*)?$/.test(image) && !image.includes('..');
  return {
    lineId: `${productId}__${size}__${color}`,
    productId,
    slug: String(line.slug || '').slice(0, 160),
    name: String(line.name || 'Nuvanti item').slice(0, 160),
    image: safeImage ? image.slice(0, 500) : 'assets/img/brand/nuvanti-logo.png',
    price,
    size,
    color,
    quantity: Math.min(quantity, 10),
  };
}
function write(lines) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  listeners.forEach((fn) => fn(lines));
}

export function onCartChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function getCart() {
  return read();
}

export function syncCartWithProducts(products) {
  const catalog = new Map((products || []).filter(Boolean).map((product) => [String(product.id), product]));
  latestCatalog = catalog;
  const removed = [];
  const adjusted = [];
  let priceChanged = false;
  const remainingByVariant = new Map();
  const lines = read().flatMap((line) => {
    const product = catalog.get(String(line.productId));
    if (!product) { removed.push(line.name); return []; }
    if ((product.sizes?.length && !product.sizes.includes(line.size))
        || (product.colors?.length && !product.colors.includes(line.color))) {
      removed.push(line.name);
      return [];
    }
    const stock = Number(product.inventory?.[line.size] ?? product.inventory?.['One Size'] ?? 0);
    if (!Number.isFinite(stock) || stock <= 0) { removed.push(line.name); return []; }
    const variantKey = `${line.productId}__${line.size}`;
    const remaining = remainingByVariant.has(variantKey) ? remainingByVariant.get(variantKey) : Math.floor(stock);
    const allowed = Math.min(10, remaining);
    if (line.quantity > allowed) {
      adjusted.push(line.name);
      line.quantity = allowed;
    }
    remainingByVariant.set(variantKey, remaining - line.quantity);
    if (line.quantity <= 0) { removed.push(line.name); return []; }
    const nextPrice = Number(product.price);
    if (Number.isFinite(nextPrice) && nextPrice !== line.price) priceChanged = true;
    line.price = Number.isFinite(nextPrice) ? nextPrice : line.price;
    line.name = product.name || line.name;
    line.image = product.images?.[0] || line.image;
    return [line];
  });
  if (removed.length || adjusted.length || priceChanged) write(lines);
  return { removed, adjusted, priceChanged };
}

// Stock is tracked per size (shared across colors). The server remains the
// source of truth; this helper uses the latest catalog loaded by cart/checkout
// pages to keep local controls within the current known stock.
export function variantStockRemaining(product, size) {
  const productId = String(product?.id || '');
  const stockProduct = product || latestCatalog.get(productId);
  const stock = Math.max(0, Math.floor(Number(stockProduct?.inventory?.[size] ?? stockProduct?.inventory?.['One Size'] ?? 0)));
  const inBag = read().filter((line) => String(line.productId) === productId && line.size === size).reduce((sum, line) => sum + line.quantity, 0);
  return Math.max(0, stock - inBag);
}

export function variantStock(productId, size) {
  const product = latestCatalog.get(String(productId));
  if (!product) return null;
  const stock = Number(product.inventory?.[size] ?? product.inventory?.['One Size'] ?? 0);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
}

export function canIncreaseQuantity(lineId) {
  const lines = read();
  const line = lines.find((item) => item.lineId === lineId);
  if (!line) return false;
  const product = latestCatalog.get(String(line.productId));
  if (!product) return line.quantity < 10;
  const stock = Math.floor(Number(product.inventory?.[line.size] ?? product.inventory?.['One Size'] ?? 0));
  const totalInBag = lines.filter((item) => item.productId === line.productId && item.size === line.size).reduce((sum, item) => sum + item.quantity, 0);
  return line.quantity < 10 && totalInBag < stock;
}

export function addToCart({ product, size, color, quantity = 1 }) {
  if (!product || !Number.isSafeInteger(Number(product.id)) || Number(product.id) < 1) return read();
  const lines = read();
  const safeSize = String(size || 'One Size').slice(0, 20);
  const safeColor = String(color || 'Default').slice(0, 60);
  const lineId = `${Number(product.id)}__${safeSize}__${safeColor}`;
  const existing = lines.find((l) => l.lineId === lineId);
  const stock = Math.max(0, Math.floor(Number(product.inventory?.[safeSize] ?? product.inventory?.['One Size'] ?? 0)));
  const inBagForSize = lines.filter((line) => line.productId === Number(product.id) && line.size === safeSize).reduce((sum, line) => sum + line.quantity, 0);
  const remaining = Math.max(0, stock - inBagForSize);
  if (remaining <= 0) return lines;
  const toAdd = Math.min(10, remaining, Math.max(1, Math.floor(Number(quantity) || 1)));
  if (existing) {
    existing.quantity = Math.min(10, existing.quantity + toAdd);
  } else {
    lines.push({
      lineId, productId: Number(product.id), slug: product.slug, name: product.name,
      image: product.colorImages?.[safeColor]?.[0] || product.images?.[0], price: Number(product.price), size: safeSize, color: safeColor,
      quantity: toAdd,
    });
  }
  const normalized = lines.map(normalizeLine).filter(Boolean);
  write(normalized);
  return normalized;
}

export function updateQuantity(lineId, quantity) {
  let lines = read();
  if (quantity <= 0) {
    lines = lines.filter((l) => l.lineId !== lineId);
  } else {
    const target = lines.find((line) => line.lineId === lineId);
    if (!target) return lines;
    const product = latestCatalog.get(String(target?.productId));
    const stock = product ? Math.floor(Number(product.inventory?.[target.size] ?? product.inventory?.['One Size'] ?? 0)) : 10;
    const otherLines = lines.filter((line) => line.lineId !== lineId && line.productId === target?.productId && line.size === target?.size).reduce((sum, line) => sum + line.quantity, 0);
    const allowed = Math.max(0, Math.min(10, stock - otherLines));
    lines = lines.flatMap((line) => line.lineId !== lineId ? [line] : allowed > 0 ? [{ ...line, quantity: Math.min(allowed, Math.floor(quantity)) }] : []);
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
  return Math.min(100, Math.round((cartSubtotal() / FREE_SHIPPING_THRESHOLD) * 100));
}

export { FREE_SHIPPING_THRESHOLD };
