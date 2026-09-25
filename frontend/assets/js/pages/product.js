import { initShell } from "../main.js";
import { icon } from "../components/icons.js";

import {
  productCardHTML,
  bindProductCardEvents,
  formatPrice,
  escapeHtml,
} from "../components/productCard.js";

import { refreshCartDrawer, openCartDrawer } from "../components/cartDrawer.js";

import { createModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

import {
  fetchProductBySlug,
  fetchRelated,
} from "../services/productService.js";

import {
  colorHex,
  stockFor,
  isInStock,
} from "../data/products.js";

import { addToCart } from "../services/cartService.js";

import { toggleWishlist, isWishlisted } from "../services/wishlistService.js";

/* =========================================================
   PAGE SETUP
   ========================================================= */

initShell({
  currentPage: "shop",
});

const RECENT_KEY = "nuvanti_recently_viewed_v1";

const params = new URLSearchParams(location.search);

const slug = params.get("slug");

let product = null;
let selectedColor = null;
let selectedSize = null;
let selectedQuantity = 1;

let galleryIndex = 0;

/* =========================================================
   INIT
   ========================================================= */

init();

async function init() {
  if (!slug) {
    renderNotFound();
    return;
  }

  try { product = await fetchProductBySlug(slug); }
  catch {
    const root = document.getElementById("productRoot");
    root.innerHTML = '<div class="state-block"><h3>Product details are temporarily unavailable</h3><p>Please try again in a moment.</p><button class="btn btn-outline" id="retryProduct">Try Again</button></div>';
    root.querySelector('#retryProduct')?.addEventListener('click', () => location.reload());
    return;
  }

  if (!product) {
    renderNotFound();
    return;
  }

  selectedColor = product.colors?.[0] || null;
  selectedSize = null;
  selectedQuantity = 1;
  galleryIndex = 0;

  document.title = `${product.name} — Nuvanti`;

  renderBreadcrumb();

  renderGallery();

  renderInfo();

  renderAccordion();

  saveRecentlyViewed();

  await loadRelated();

  await loadRecentlyViewed();
}

/* =========================================================
   NOT FOUND
   ========================================================= */

function renderNotFound() {
  const root = document.getElementById("productRoot");

  if (!root) return;

  root.innerHTML = `
    <div class="state-block">

      <h3>Product not found</h3>

      <p>
        The item you're looking for may have sold out or moved.
      </p>

      <a
        href="shop.html"
        class="btn btn-primary"
      >
        Back to Shop
      </a>

    </div>
  `;
}

/* =========================================================
   BREADCRUMB
   ========================================================= */

function renderBreadcrumb() {
  const breadcrumb = document.getElementById("breadcrumb");

  if (!breadcrumb) return;

  breadcrumb.innerHTML = `

    <a href="index.html">
      Home
    </a>

    <span class="breadcrumb-sep">
      ›
    </span>

    <a href="shop.html?category=${encodeURIComponent(product.category)}">
      ${escapeHtml(capitalize(product.category))}
    </a>

    <span class="breadcrumb-sep">
      ›
    </span>

    <span>
      ${escapeHtml(product.name)}
    </span>

  `;
}

/* =========================================================
   GALLERY
   ========================================================= */

function renderGallery() {
  const gallery = document.getElementById("gallery");

  if (!gallery) return;

  const images = Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : [];

  /*
   * If product has no images, show a clean fallback.
   */
  if (images.length === 0) {
    gallery.innerHTML = `
      <div
        class="gallery__main"
        style="cursor:default"
      >
        <div
          style="
            width:100%;
            height:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            color:var(--color-muted);
          "
        >
          No image available
        </div>
      </div>
    `;

    return;
  }

  galleryIndex = Math.min(galleryIndex, images.length - 1);

  gallery.innerHTML = `

    <div
      class="gallery__main"
      id="galleryMain"
      aria-label="Product image viewer"
    >

      <img
        src="${escapeAttribute(images[galleryIndex])}"
        alt="${escapeAttribute(product.name)}"
        id="galleryMainImg"
        draggable="false"
        decoding="async"
        fetchpriority="high"
      />

    </div>

    ${
      images.length > 1
        ? `
          <div
            class="gallery__thumbs"
            role="tablist"
            aria-label="Product images"
          >

            ${images
              .map(
                (img, index) => `

              <button
                type="button"
                class="gallery__thumb"
                role="tab"
                aria-selected="${index === galleryIndex}"
                data-index="${index}"
                data-src="${escapeAttribute(img)}"
                data-active="${index === galleryIndex}"
                aria-label="View image ${index + 1}"
              >

                <img
                  src="${escapeAttribute(img)}"
                  alt=""
                  loading="${index === 0 ? "eager" : "lazy"}"
                  decoding="async"
                  draggable="false"
                />

              </button>

            `,
              )
              .join("")}

          </div>
        `
        : ""
    }

  `;

  /* ---------------------------------------------------------
     PRELOAD REMAINING IMAGES
     --------------------------------------------------------- */

  preloadImages(images);

  /* ---------------------------------------------------------
     THUMBNAIL EVENTS
     --------------------------------------------------------- */

  gallery.querySelectorAll(".gallery__thumb").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);

      setGalleryImage(index);
    });
  });

  /* ---------------------------------------------------------
     MAIN IMAGE
     --------------------------------------------------------- */

  const main = document.getElementById("galleryMain");

  if (!main) return;

  const hasMouse = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;

  if (hasMouse) {
    /*
     * Desktop:
     * Click = zoom.
     */
    main.addEventListener("click", () => {
      main.classList.toggle("is-zoomed");
    });
  } else {
    /*
     * Mobile:
     * Open fullscreen lightbox.
     */
    main.addEventListener("click", () => {
      openLightbox(galleryIndex);
    });
  }

  /* ---------------------------------------------------------
     MAIN IMAGE LOAD TRANSITION
     --------------------------------------------------------- */

  const mainImg = document.getElementById("galleryMainImg");

  if (mainImg) {
    mainImg.addEventListener("load", () => {
      mainImg.style.opacity = "1";
    });

    mainImg.addEventListener("error", () => {
      mainImg.style.opacity = "0.35";
    });
  }
}

/* =========================================================
   SET GALLERY IMAGE
   ========================================================= */

function setGalleryImage(index) {
  if (!product?.images?.length) return;

  const images = product.images.filter(Boolean);

  if (!images.length) return;

  galleryIndex = (index + images.length) % images.length;

  const main = document.getElementById("galleryMain");

  const mainImg = document.getElementById("galleryMainImg");

  if (!main || !mainImg) return;

  /*
   * Remove zoom whenever changing image.
   * Prevents the next image from appearing zoomed.
   */

  main.classList.remove("is-zoomed");

  /*
   * Small fade during image switch.
   */

  mainImg.style.opacity = "0";

  setTimeout(() => {
    mainImg.src = images[galleryIndex];

    mainImg.alt = product.name;
  }, 80);

  /*
   * Update thumbnails.
   */

  document.querySelectorAll(".gallery__thumb").forEach((button) => {
    const buttonIndex = Number(button.dataset.index);

    const active = buttonIndex === galleryIndex;

    button.dataset.active = String(active);

    button.setAttribute("aria-selected", String(active));
  });
}

/* =========================================================
   PRELOAD IMAGES
   ========================================================= */

function preloadImages(images) {
  images.slice(1).forEach((src) => {
    const img = new Image();

    img.decoding = "async";

    img.src = src;
  });
}

/* =========================================================
   LIGHTBOX
   ========================================================= */

function openLightbox(startIndex = 0) {
  const images = product?.images?.filter(Boolean) || [];

  if (!images.length) return;

  let index = ((startIndex % images.length) + images.length) % images.length;

  let box = document.getElementById("productLightbox");

  /* ---------------------------------------------------------
     CREATE LIGHTBOX ONCE
     --------------------------------------------------------- */

  if (!box) {
    box = document.createElement("div");

    box.className = "lightbox";

    box.id = "productLightbox";

    box.setAttribute("aria-label", "Product image gallery");

    box.innerHTML = `

      <button
        type="button"
        class="lightbox__close"
        aria-label="Close image viewer"
      >
        ${icon("close")}
      </button>

      <button
        type="button"
        class="lightbox__arrow lightbox__arrow--prev"
        aria-label="Previous image"
      >
        ${icon("chevronLeft")}
      </button>

      <img
        id="lightboxImg"
        alt=""
        draggable="false"
        decoding="async"
      />

      <button
        type="button"
        class="lightbox__arrow lightbox__arrow--next"
        aria-label="Next image"
      >
        ${icon("chevronRight")}
      </button>

    `;

    document.body.appendChild(box);

    /* -------------------------------------------------------
       CLOSE
       ------------------------------------------------------- */

    box.querySelector(".lightbox__close").addEventListener("click", close);

    box.addEventListener("click", (event) => {
      if (event.target === box) {
        close();
      }
    });

    /* -------------------------------------------------------
       PREVIOUS / NEXT
       ------------------------------------------------------- */

    box
      .querySelector(".lightbox__arrow--prev")
      .addEventListener("click", (event) => {
        event.stopPropagation();

        navigate(-1);
      });

    box
      .querySelector(".lightbox__arrow--next")
      .addEventListener("click", (event) => {
        event.stopPropagation();

        navigate(1);
      });

    /* -------------------------------------------------------
       KEYBOARD
       ------------------------------------------------------- */

    document.addEventListener("keydown", (event) => {
      if (!box || box.dataset.open !== "true") {
        return;
      }

      if (event.key === "Escape") {
        close();
      }

      if (event.key === "ArrowLeft") {
        navigate(-1);
      }

      if (event.key === "ArrowRight") {
        navigate(1);
      }
    });

    /* -------------------------------------------------------
       TOUCH SWIPE
       ------------------------------------------------------- */

    let touchStartX = 0;

    let touchEndX = 0;

    box.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.changedTouches[0].screenX;
      },
      { passive: true },
    );

    box.addEventListener(
      "touchend",
      (event) => {
        touchEndX = event.changedTouches[0].screenX;

        const difference = touchEndX - touchStartX;

        if (Math.abs(difference) < 50) {
          return;
        }

        if (difference < 0) {
          navigate(1);
        } else {
          navigate(-1);
        }
      },
      { passive: true },
    );
  }

  const image = box.querySelector("#lightboxImg");

  function render() {
    image.style.opacity = "0";

    image.src = images[index];

    image.alt = `${product.name} — Image ${index + 1}`;

    image.onload = () => {
      image.style.opacity = "1";
    };
  }

  function navigate(direction) {
    index = (index + direction + images.length) % images.length;

    render();
  }

  function close() {
    box.dataset.open = "false";

    document.body.style.overflow = "";
  }

  render();

  box.dataset.open = "true";

  document.body.style.overflow = "hidden";
}

/* =========================================================
   PRODUCT INFORMATION
   ========================================================= */

function renderInfo() {
  const container = document.getElementById("productInfo");

  if (!container) return;

  const wished = isWishlisted(product.id);

  const productInStock = isInStock(product);

  container.innerHTML = `

    <p class="label product-info__eyebrow">

      ${escapeHtml(capitalize(product.category))}

      ${product.badges?.length ? " · " + product.badges.map(escapeHtml).join(", ") : ""}

    </p>


    <h1 class="product-info__name">
      ${escapeHtml(product.name)}
    </h1>


    <div class="product-info__price">

      <span>
        ${formatPrice(product.price)}
      </span>

      ${
        product.compareAtPrice
          ? `
            <span class="product-info__compare">
              ${formatPrice(product.compareAtPrice)}
            </span>
          `
          : ""
      }

    </div>


    <p class="product-info__desc">
      ${escapeHtml(product.description)}
    </p>


    <!-- COLOR -->

    <div class="option-group">

      <div class="option-group__head">

        <span class="label">
          Color — ${escapeHtml(selectedColor || "Select")}
        </span>

      </div>


      <div
        class="color-options"
        id="colorOptions"
      >

        ${(product.colors || [])
          .map(
            (color) => `

            <button
              type="button"
              class="color-option"
              data-color="${escapeAttribute(color)}"
              data-active="${color === selectedColor}"
              style="background:${colorHex(color)}"
              aria-label="${escapeAttribute(color)}"
              title="${escapeAttribute(color)}"
            ></button>

          `,
          )
          .join("")}

      </div>

    </div>


    <!-- SIZE -->

    <div class="option-group">

      <div class="option-group__head">

        <span class="label">
          Size
        </span>

        <button
          type="button"
          class="btn-text"
          id="openSizeGuide"
          style="font-size:.8rem"
        >
          Size Guide
        </button>

      </div>


      <div
        class="size-options"
        id="sizeOptions"
      >

        ${(product.sizes || [])
          .map((size) => {
            const stock = stockFor(product, size);

            return `

              <button
                type="button"
                class="size-option"
                data-size="${escapeAttribute(size)}"
                data-active="${size === selectedSize}"
                ${stock === 0 ? "disabled" : ""}
              >
                ${escapeHtml(size)}
              </button>

            `;
          })
          .join("")}

      </div>

    </div>


    <!-- QUANTITY -->

    <div class="option-group">

      <div class="option-group__head">

        <span class="label">
          Quantity
        </span>

      </div>


      <div
        class="qty-stepper"
        id="qtyStepper"
        style="width:fit-content"
      >

        <button
          type="button"
          id="qtyDec"
          aria-label="Decrease quantity"
        >
          ${icon("minus")}
        </button>

        <span id="qtyValue">
          ${selectedQuantity}
        </span>

        <button
          type="button"
          id="qtyInc"
          aria-label="Increase quantity"
        >
          ${icon("plus")}
        </button>

      </div>

    </div>


    <!-- STOCK -->

    <p
      class="stock-line"
      id="stockLine"
    >

      ${
        productInStock
          ? `
            <span class="stock-dot"></span>
            Select a size to check availability
          `
          : `
            <span class="stock-dot stock-dot--out"></span>
            Currently sold out — check back soon
          `
      }

    </p>


    <!-- PURCHASE -->

    <div class="purchase-row">

      <button
        class="btn btn-primary"
        id="addToCartBtn"
        ${productInStock ? "" : "disabled"}
      >
        ${productInStock ? "Add to Cart" : "Sold Out"}
      </button>


      <button
        class="btn btn-outline"
        id="buyNowBtn"
        ${productInStock ? "" : "disabled"}
      >
        Buy Now
      </button>


      <button
        type="button"
        class="icon-btn"
        style="border:1px solid var(--color-border)"
        id="wishlistBtn"
        data-active="${wished}"
        aria-pressed="${wished}"
        aria-label="Toggle wishlist"
      >
        ${icon("heart")}
      </button>

    </div>


    <!-- PRODUCT META -->

    <div
      style="
        font-size:var(--fs-small);
        color:var(--color-muted);
        display:flex;
        flex-direction:column;
        gap:.5rem
      "
    >

      <span>
        Ships inside Egypt only — Cairo &amp; Giza in 2–6 business days.
      </span>

      <span>
        Exchange within 14 days of delivery. Refunds are not available.
      </span>

      <span>
        Material: ${escapeHtml(product.material || 'Cotton blend')}
      </span>

    </div>

  `;

  bindInfoEvents();
}

/* =========================================================
   PRODUCT INFO EVENTS
   ========================================================= */

function bindInfoEvents() {
  /* ---------------------------------------------------------
     COLORS
     --------------------------------------------------------- */

  const colors = document.getElementById("colorOptions");

  if (colors) {
    colors.addEventListener("click", (event) => {
      const button = event.target.closest("[data-color]");

      if (!button) return;

      selectedColor = button.dataset.color;

      renderInfo();

      reattachAccordionOpen();
    });
  }

  /* ---------------------------------------------------------
     SIZES
     --------------------------------------------------------- */

  const sizes = document.getElementById("sizeOptions");

  if (sizes) {
    sizes.addEventListener("click", (event) => {
      const button = event.target.closest("[data-size]");

      if (!button || button.disabled) {
        return;
      }

      document.querySelectorAll("#sizeOptions [data-size]").forEach((item) => {
        item.dataset.active = "false";
      });

      button.dataset.active = "true";

      selectedSize = button.dataset.size;

      updateStockLine();
    });
  }

  /* ---------------------------------------------------------
     QUANTITY
     --------------------------------------------------------- */

  const quantityValue = document.getElementById("qtyValue");

  const quantityDec = document.getElementById("qtyDec");

  const quantityInc = document.getElementById("qtyInc");

  if (quantityValue && quantityDec && quantityInc) {
    quantityDec.addEventListener("click", () => {
      selectedQuantity = Math.max(1, selectedQuantity - 1);

      quantityValue.textContent = selectedQuantity;
    });

    quantityInc.addEventListener("click", () => {
      selectedQuantity = Math.min(10, selectedQuantity + 1);

      quantityValue.textContent = selectedQuantity;
    });
  }

  /* ---------------------------------------------------------
     ADD TO CART
     --------------------------------------------------------- */

  const addButton = document.getElementById("addToCartBtn");

  if (addButton) {
    addButton.addEventListener("click", () => {
      if (!selectedSize) {
        showSizeError();

        return;
      }

      const originalLabel = "Add to Cart";

      addButton.disabled = true;

      addButton.textContent = "Adding…";

      setTimeout(() => {
        addToCart({
          product,

          size: selectedSize,

          color: selectedColor,

          quantity: selectedQuantity,
        });

        addButton.textContent = "Added ✓";

        addButton.classList.add("btn-success");

        refreshCartDrawer();

        setTimeout(() => {
          addButton.textContent = originalLabel;

          addButton.classList.remove("btn-success");

          addButton.disabled = false;

          openCartDrawer();
        }, 700);
      }, 300);
    });
  }

  /* ---------------------------------------------------------
     BUY NOW
     --------------------------------------------------------- */

  const buyNow = document.getElementById("buyNowBtn");

  if (buyNow) {
    buyNow.addEventListener("click", () => {
      if (!selectedSize) {
        showSizeError();

        return;
      }

      addToCart({
        product,

        size: selectedSize,

        color: selectedColor,

        quantity: selectedQuantity,
      });

      location.href = "checkout.html";
    });
  }

  /* ---------------------------------------------------------
     WISHLIST
     --------------------------------------------------------- */

  const wishlist = document.getElementById("wishlistBtn");

  if (wishlist) {
    wishlist.addEventListener("click", (event) => {
      const active = toggleWishlist(product.id);

      const now = active.includes(product.id);

      event.currentTarget.dataset.active = String(now);

      event.currentTarget.setAttribute("aria-pressed", String(now));

      showToast(now ? "Added to wishlist" : "Removed from wishlist", {
        icon: "heart",
      });
    });
  }

  /* ---------------------------------------------------------
     SIZE GUIDE
     --------------------------------------------------------- */

  const sizeGuide = document.getElementById("openSizeGuide");

  if (sizeGuide) {
    sizeGuide.addEventListener("click", openSizeGuide);
  }
}

/* =========================================================
   SIZE ERROR
   ========================================================= */

function showSizeError() {
  showToast("Please select a size", {
    icon: "alertTriangle",
  });

  const sizeGroup = document.getElementById("sizeOptions");

  if (!sizeGroup) return;

  sizeGroup.classList.add("shake");

  setTimeout(() => {
    sizeGroup.classList.remove("shake");
  }, 400);
}

/* =========================================================
   SIZE GUIDE
   ========================================================= */

function openSizeGuide() {
  const modal = createModal({
    title: "Size Guide",

    bodyHTML: `

        <table class="size-table">

          <thead>

            <tr>
              <th>Size</th>
              <th>Chest (cm)</th>
              <th>Length (cm)</th>
              <th>Sleeve (cm)</th>
            </tr>

          </thead>


          <tbody>

            <tr>
              <td>XS</td>
              <td>92</td>
              <td>66</td>
              <td>58</td>
            </tr>

            <tr>
              <td>S</td>
              <td>98</td>
              <td>68</td>
              <td>60</td>
            </tr>

            <tr>
              <td>M</td>
              <td>104</td>
              <td>70</td>
              <td>62</td>
            </tr>

            <tr>
              <td>L</td>
              <td>110</td>
              <td>72</td>
              <td>64</td>
            </tr>

            <tr>
              <td>XL</td>
              <td>116</td>
              <td>74</td>
              <td>66</td>
            </tr>

            <tr>
              <td>XXL</td>
              <td>122</td>
              <td>76</td>
              <td>68</td>
            </tr>

          </tbody>

        </table>


        <p
          class="text-muted"
          style="font-size:.85rem"
        >

          Measurements are of the garment,
          laid flat.

          <a
            href="size-guide.html"
            class="btn-text"
          >
            Full size guide →
          </a>

        </p>

      `,
  });

  modal.open();
}

/* =========================================================
   STOCK
   ========================================================= */

function updateStockLine() {
  const stock = stockFor(product, selectedSize);

  const element = document.getElementById("stockLine");

  if (!element) return;

  if (stock === 0) {
    element.innerHTML = `

      <span class="stock-dot stock-dot--out"></span>
      Out of stock in this size

    `;
  } else if (stock <= 4) {
    element.innerHTML = `

      <span class="stock-dot stock-dot--low"></span>
      Only ${stock} left in size ${escapeHtml(selectedSize)}

    `;
  } else {
    element.innerHTML = `

      <span class="stock-dot"></span>
      In stock — ships within 2 business days

    `;
  }
}

/* =========================================================
   ACCORDION
   ========================================================= */

function renderAccordion() {
  const accordion = document.getElementById("infoAccordion");

  if (!accordion) return;

  const items = [
    {
      title: "Shipping",

      body: "We ship inside Egypt only. Orders are processed within 1–3 business days, with delivery to Cairo &amp; Giza in 2–6 business days. Shipping fees are calculated based on your location and shown at checkout.",
    },

    {
      title: "Returns",

      body: "We offer exchange only, within 14 days of delivery, for unused items in original condition with the invoice. Refunds are not available except in the case of a reported manufacturing defect. See our full <a href=\"refund-policy.html\">Exchange &amp; Refund Policy</a>.",
    },

    {
      title: "Product Details",

      body: `${escapeHtml(product.material || 'Cotton blend')}. Designed in-house. Model is 183cm and wears size M.`,
    },
  ];

  accordion.innerHTML = items
    .map(
      (item, index) => `

      <div class="accordion-item">

        <button
          type="button"
          class="accordion-trigger"
          aria-expanded="false"
          aria-controls="acc-${index}"
          id="acc-trigger-${index}"
        >

          ${item.title}

          <span class="plus">
            ${icon("plus")}
          </span>

        </button>


        <div
          class="accordion-panel"
          id="acc-${index}"
          role="region"
          aria-labelledby="acc-trigger-${index}"
        >

          <div class="accordion-panel__inner">
            ${item.body}
          </div>

        </div>

      </div>

    `,
    )
    .join("");

  reattachAccordionOpen();
}

/* =========================================================
   ACCORDION EVENTS
   ========================================================= */

function reattachAccordionOpen() {
  document.querySelectorAll(".accordion-trigger").forEach((trigger) => {
    /*
     * Prevent duplicate listeners.
     */

    if (trigger.dataset.bound === "true") {
      return;
    }

    trigger.dataset.bound = "true";

    trigger.addEventListener("click", () => {
      const panel = document.getElementById(
        trigger.getAttribute("aria-controls"),
      );

      if (!panel) return;

      const isOpen = trigger.getAttribute("aria-expanded") === "true";

      trigger.setAttribute("aria-expanded", String(!isOpen));

      panel.style.maxHeight = isOpen ? "0px" : `${panel.scrollHeight}px`;
    });
  });
}

/* =========================================================
   RELATED PRODUCTS
   ========================================================= */

async function loadRelated() {
  const element = document.getElementById("relatedGrid");
  const section = document.getElementById("relatedSection");
  if (!element || !section) return;
  let list;
  try { list = await fetchRelated(product, 4); }
  catch { section.hidden = true; return; }

  if (!list.length) {
    section.hidden = true;

    return;
  }

  element.innerHTML = list.map(productCardHTML).join("");

  bindProductCardEvents(element, {
    products: list,
    onCartChange: refreshCartDrawer,
  });
}

/* =========================================================
   RECENTLY VIEWED
   ========================================================= */

function saveRecentlyViewed() {
  let recent = getRecent().filter((item) => item !== product.slug);

  recent.unshift(product.slug);

  recent = recent.slice(0, 8);

  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function getRecent() {
  try {
    const stored = localStorage.getItem(RECENT_KEY);

    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

async function loadRecentlyViewed() {
  const recent = getRecent().filter((item) => item !== product.slug);

  const section = document.getElementById("recentlyViewedSection");

  const grid = document.getElementById("recentlyViewedGrid");

  if (!section || !grid) return;

  if (!recent.length) {
    section.hidden = true;

    return;
  }

  const list = (await Promise.all(recent.slice(0, 4).map((slug) => fetchProductBySlug(slug).catch(() => null))))
    .filter(Boolean);

  if (!list.length) {
    section.hidden = true;

    return;
  }

  grid.innerHTML = list.map(productCardHTML).join("");

  bindProductCardEvents(grid, {
    products: list,
    onCartChange: refreshCartDrawer,
  });
}

/* =========================================================
   HELPERS
   ========================================================= */

function capitalize(value) {
  if (!value) return "";

  return value.charAt(0).toUpperCase() + value.slice(1);
}

/*
 * Prevent product data from accidentally breaking
 * the gallery HTML if an image URL contains quotes.
 */

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
