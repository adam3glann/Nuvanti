import { icon } from "./icons.js";
import { colorHex, isInStock } from "../data/products.js";
import { toggleWishlist, isWishlisted } from "../services/wishlistService.js";
import { addToCart } from "../services/cartService.js?v=account-cart-sync-1";
import { showToast } from "./toast.js";
import { initScrollReveal } from "./scrollReveal.js";

export function productCardHTML(product, index = 0) {
  const images = Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : [];
  let colors = Array.isArray(product.colors) ? product.colors : [];
  const badges = Array.isArray(product.badges) ? product.badges : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const image = images[0] || "assets/img/brand/nuvanti-logo.png";
  const alt = images[1] || image;
  const slug = encodeURIComponent(String(product.slug || ""));
  const name = escapeHtml(product.name || "Nuvanti item");
  const wished = isWishlisted(product.id);
  const isSet = Boolean(product.bundle?.crewneck && product.bundle?.sweatpants);
  let sharedColors = [];
  if (isSet) {
    const crewneck = product.bundle.crewneck;
    const sweatpants = product.bundle.sweatpants;
    const crewneckColors = crewneck.colors?.length ? crewneck.colors : ["Default"];
    const sweatpantsColors = sweatpants.colors?.length ? sweatpants.colors : ["Default"];
    sharedColors = crewneckColors.flatMap((color) => {
      const matching = sweatpantsColors.find((candidate) => candidate.trim().toLowerCase() === color.trim().toLowerCase());
      if (!matching) return [];
      const hasStock = (part, partColor) => (part.sizes?.length ? part.sizes : ["One Size"]).some((size) => Number(part.inventoryByVariant?.[`${partColor}::${size}`] ?? part.inventory?.[size] ?? 0) > 0);
      return hasStock(crewneck, color) && hasStock(sweatpants, matching) ? [color] : [];
    });
    colors = sharedColors;
  }
  const inStock = isSet ? sharedColors.length > 0 : isInStock(product) && sizes.length > 0;
  const style = product.setCardStyle || "none", effect = product.setCardEffect || "none";
  const accent = /^#[0-9a-f]{6}$/i.test(product.setCardAccent || "") ? product.setCardAccent : "#d8a94c";
  return `
    <article class="product-card reveal ${isSet ? `product-card--set set-card--${style} set-effect--${effect}` : ""}" data-product-id="${escapeHtml(product.id)}" style="--card-order:${Math.min(Number(index) || 0, 7)};--set-accent:${accent};--set-intensity:${Math.min(3,Math.max(1,Number(product.setCardIntensity)||1))}">
      <a href="product.html?slug=${slug}" class="product-card__media" aria-label="View ${name}">
        <img src="${escapeHtml(image)}" alt="${name}" loading="lazy" width="600" height="750" />
        <img src="${escapeHtml(alt)}" alt="" class="img-alt" loading="lazy" width="600" height="750" />
      </a>
      <div class="product-card__badges">
        ${badges.map((b) => `<span class="badge ${b === "SALE" ? "badge--sale" : ""}">${escapeHtml(b)}</span>`).join("")}
        ${isSet ? '<span class="badge">SET</span>' : ""}
        ${!inStock ? '<span class="badge badge--outline">Sold out</span>' : ""}
      </div>
      <button class="product-card__wishlist icon-btn" data-wishlist-toggle="${escapeHtml(product.id)}" data-active="${wished}"
        aria-pressed="${wished}" aria-label="${wished ? "Remove from wishlist" : "Add to wishlist"}">
        ${icon("heart")}
      </button>
      <a href="product.html?slug=${slug}">
        <p class="product-card__name">${name}</p>
        <div class="product-card__meta">
          <span class="product-card__price">${formatPrice(product.price)}</span>
          ${product.compareAtPrice ? `<span class="product-card__compare">${formatPrice(product.compareAtPrice)}</span>` : ""}
        </div>
        <div class="product-card__swatches">
          ${colors.map((c) => `<span class="swatch" style="background:${colorHex(c, isSet ? product.bundle.crewneck.colorSwatches : product.colorSwatches)}" title="${escapeHtml(c)}" aria-label="${escapeHtml(c)}"></span>`).join("")}
        </div>
      </a>
      <div class="product-card__quick">
        <button class="btn btn-sm" data-quick-add="${escapeHtml(product.id)}" ${!inStock ? "disabled" : ""}>
          ${inStock ? (isSet ? "Choose Set" : "Quick Add") : "Sold Out"}
        </button>
      </div>
    </article>
  `;
}

export function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`
    : "Price unavailable";
}

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

// Delegated listeners — attach once per stable container and refresh the
// current product map as async filters/search results replace its contents.
const productCardBindings = new WeakMap();
export function bindProductCardEvents(
  container,
  { products, onCartChange } = {},
) {
  initScrollReveal(container);
  const current = productCardBindings.get(container);
  if (current) {
    current.products = products || [];
    current.onCartChange = onCartChange;
    return;
  }
  const binding = { products: products || [], onCartChange };
  productCardBindings.set(container, binding);
  let touchStart = null;
  let suppressClickUntil = 0;
  container.addEventListener(
    "touchstart",
    (event) => {
      const media = event.target.closest(".product-card__media");
      const touch = event.changedTouches[0];
      touchStart =
        media && touch ? { media, x: touch.clientX, y: touch.clientY } : null;
    },
    { passive: true },
  );
  container.addEventListener(
    "touchend",
    (event) => {
      if (!touchStart) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      const media = touchStart.media;
      touchStart = null;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const card = media.closest(".product-card");
      const product = binding.products.find(
        (item) => String(item.id) === card?.dataset.productId,
      );
      const images = product?.images?.filter(Boolean) || [];
      if (images.length < 2) return;
      event.preventDefault();
      suppressClickUntil = Date.now() + 500;
      const index = Number(media.dataset.imageIndex) || 0;
      const nextIndex =
        (index + (dx < 0 ? 1 : -1) + images.length) % images.length;
      media.dataset.imageIndex = String(nextIndex);
      const primary = media.querySelector("img:not(.img-alt)");
      const alternate = media.querySelector("img.img-alt");
      if (primary) {
        primary.src = images[nextIndex];
        primary.alt = product.name || "Nuvanti item";
      }
      if (alternate) alternate.src = images[(nextIndex + 1) % images.length];
    },
    { passive: false },
  );
  container.addEventListener(
    "touchcancel",
    () => {
      touchStart = null;
    },
    { passive: true },
  );
  container.addEventListener("click", (e) => {
    if (
      Date.now() < suppressClickUntil &&
      e.target.closest(".product-card__media")
    ) {
      e.preventDefault();
      suppressClickUntil = 0;
      return;
    }
    const wishBtn = e.target.closest("[data-wishlist-toggle]");
    if (wishBtn) {
      e.preventDefault();
      const id = wishBtn.dataset.wishlistToggle;
      const active = toggleWishlist(id);
      const nowActive = active.includes(id);
      wishBtn.dataset.active = String(nowActive);
      wishBtn.setAttribute("aria-pressed", String(nowActive));
      showToast(nowActive ? "Added to wishlist" : "Removed from wishlist", {
        icon: "heart",
      });
      return;
    }
    const quickAdd = e.target.closest("[data-quick-add]");
    if (quickAdd) {
      e.preventDefault();
      const id = quickAdd.dataset.quickAdd;
      const product = binding.products.find((p) => String(p.id) === String(id));
      if (!product) return;
      if (product.bundle?.crewneck && product.bundle?.sweatpants) { location.href = `product.html?slug=${encodeURIComponent(product.slug || "")}`; return; }
      const color =
        product.colors?.find((candidate) =>
          product.sizes.some(
            (s) =>
              Number(
                product.inventoryByVariant?.[`${candidate}::${s}`] ??
                  product.inventory?.[s] ??
                  0,
              ) > 0,
          ),
        ) ||
        product.colors?.[0] ||
        "Default";
      const size =
        product.sizes.find(
          (s) =>
            Number(
              product.inventoryByVariant?.[`${color}::${s}`] ??
                product.inventory?.[s] ??
                0,
            ) > 0,
        ) || product.sizes[0];
      addToCart({ product, size, color, quantity: 1 });
      showToast(`${product.name} added to bag`, { icon: "bag" });
      binding.onCartChange?.();
    }
  });
}
