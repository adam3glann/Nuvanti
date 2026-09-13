// wishlistService — local-state wishlist, structured to later sync to a
// signed-in user's account via API instead of localStorage.
const STORAGE_KEY = 'nuvanti_wishlist_v1';
let listeners = [];

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function write(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  listeners.forEach((fn) => fn(ids));
}

export function onWishlistChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function getWishlist() {
  return read();
}

export function isWishlisted(productId) {
  return read().includes(productId);
}

export function toggleWishlist(productId) {
  const ids = read();
  const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId];
  write(next);
  return next;
}

export function removeFromWishlist(productId) {
  write(read().filter((id) => id !== productId));
}
