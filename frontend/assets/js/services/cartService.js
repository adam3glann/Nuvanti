// cartService — local-state cart, structured so `add/remove/updateQty`
// can later dispatch to a Node API (POST /cart, PATCH /cart/:lineId, etc.)
// instead of writing to localStorage.
const STORAGE_KEY = 'nuvanti_cart_v1';
let FREE_SHIPPING_THRESHOLD = 3000;

export function configureFreeShippingThreshold(value) {
  if (Number.isFinite(value) && value >= 0) FREE_SHIPPING_THRESHOLD = value;
}

let listeners = [];

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
  const removed = [];
  const adjusted = [];
  let priceChanged = false;
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
    if (line.quantity > stock) {
      adjusted.push(line.name);
      line.quantity = Math.min(10, Math.floor(stock));
    }
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

export function addToCart({ product, size, color, quantity = 1 }) {
  if (!product || !Number.isSafeInteger(Number(product.id)) || Number(product.id) < 1) return read();
  const lines = read();
  const safeSize = String(size || 'One Size').slice(0, 20);
  const safeColor = String(color || 'Default').slice(0, 60);
  const lineId = `${Number(product.id)}__${safeSize}__${safeColor}`;
  const existing = lines.find((l) => l.lineId === lineId);
  if (existing) {
    existing.quantity = Math.min(10, existing.quantity + Math.max(1, Number(quantity) || 1));
  } else {
    lines.push({
      lineId, productId: Number(product.id), slug: product.slug, name: product.name,
      image: product.images?.[0], price: Number(product.price), size: safeSize, color: safeColor,
      quantity: Math.min(10, Math.max(1, Math.floor(Number(quantity) || 1))),
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
    lines = lines.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.min(10, Math.floor(quantity)) } : l));
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
