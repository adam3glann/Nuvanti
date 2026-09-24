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
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
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

export function addToCart({ product, size, color, quantity = 1 }) {
  const lines = read();
  const lineId = `${product.id}__${size}__${color}`;
  const existing = lines.find((l) => l.lineId === lineId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    lines.push({
      lineId, productId: product.id, slug: product.slug, name: product.name,
      image: product.images[0], price: product.price, size, color, quantity,
    });
  }
  write(lines);
  return lines;
}

export function updateQuantity(lineId, quantity) {
  let lines = read();
  if (quantity <= 0) {
    lines = lines.filter((l) => l.lineId !== lineId);
  } else {
    lines = lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l));
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
