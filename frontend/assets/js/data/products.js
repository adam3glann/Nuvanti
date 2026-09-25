// Product catalog — real Nuvanti products, built from photos and product
// pages supplied directly. Prices, sizes, colors, and SKUs match what was
// shown on the live store at the time these were provided. Swap
// `productService` to fetch from the Node API once the backend exists;
// nothing else in the app should need to change.

function productImages(slug, color, count) {
  return Array.from({ length: count }, (_, i) => `assets/img/products/${slug}/${color}-${i + 1}.webp`);
}

const COLOR_HEX = {
  Black: '#121114', Grey: '#9A9690', Olive: '#5B5A42',
  Navy: '#232B3B', 'Off-White': '#EFEBE2',
  Cup: '#EFEBE2', 'Nuvanti Star': '#EFEBE2',
};

export const products = [
  {
    id: 'p-001', slug: 'embroidered-tank-top', name: 'Embroidered Tank Top',
    description: 'A fitted ribbed tank in soft cream cotton, finished with a hand-drawn embroidery on the chest. Pick the martini "Cup" motif or the Nuvanti Star crest — both sit on the same close-knit rib body that layers cleanly under a shirt or wears alone.',
    price: 250, compareAtPrice: 300, category: 'tank-tops', collection: 'womens',
    colors: ['Cup', 'Nuvanti Star'], sizes: ['S', 'M', 'L'],
    images: [...productImages('embroidered-tank-top', 'cup', 3), ...productImages('embroidered-tank-top', 'nuvanti-star', 2)],
    material: 'Ribbed cotton-elastane blend', sku: 'SKU1',
    badges: ['SALE'], featured: true, bestseller: true, newArrival: false,
    inventory: { S: 8, M: 12, L: 6 },
  },
  {
    id: 'p-002', slug: 'men-tank-top', name: 'Men Tank Top',
    description: 'A clean ribbed tank built for warm-weather layering — minimal branding, close-to-body fit, and a length made to sit right whether it\'s worn alone or under an open shirt.',
    price: 200, compareAtPrice: 250, category: 'tank-tops', collection: 'mens',
    colors: ['Black', 'Grey'], sizes: ['S', 'M', 'L'],
    images: productImages('men-tank-top', 'black', 2).concat(productImages('men-tank-top', 'grey', 2)),
    material: 'Ribbed cotton', sku: 'SKU4',
    badges: ['SALE'], featured: true, bestseller: false, newArrival: false,
    inventory: { S: 10, M: 14, L: 9 },
  },
  {
    id: 'p-003', slug: 'nuv-sweatpants', name: 'Nuv Sweatpants',
    description: 'Wide-leg sweatpants crafted from premium cotton for elevated everyday comfort. A relaxed drape through the leg, a zip phone pocket at the thigh, and a graffiti-style Nuvanti patch on the back pocket — built for movement, not just standing still.',
    price: 500, compareAtPrice: 680, category: 'sweatpants', collection: 'unisex',
    colors: ['Black', 'Olive', 'Grey'], sizes: ['S', 'M', 'L', 'XL'],
    images: [
      ...productImages('nuv-sweatpants', 'olive', 4),
      ...productImages('nuv-sweatpants', 'black', 4),
      ...productImages('nuv-sweatpants', 'grey', 4),
    ],
    material: 'Premium cotton fleece', sku: 'SKU3',
    badges: ['LIMITED'], featured: true, bestseller: true, newArrival: false,
    // Matches the live store's current status: this style is sold out across every size.
    inventory: { S: 0, M: 0, L: 0, XL: 0 },
  },
  {
    id: 'p-004', slug: 'knitted-embroidered-polo', name: 'Knitted Embroidered Polo',
    description: 'A ribbed knit polo with contrast tipping at the collar and cuffs, the Nuvanti script embroidered on the chest and the star crest on the back shoulder. Soft-touch knit that layers well over a tee or wears solo with wide trousers.',
    price: 630, compareAtPrice: 700, category: 'polos', collection: 'unisex',
    colors: ['Navy', 'Off-White', 'Olive'], sizes: ['M', 'L', 'XL'],
    images: [
      ...productImages('knitted-embroidered-polo', 'navy', 5),
      ...productImages('knitted-embroidered-polo', 'off-white', 4),
      ...productImages('knitted-embroidered-polo', 'olive', 3),
    ],
    material: 'Knitted cotton blend', sku: 'SKU2',
    badges: ['SALE', 'BESTSELLER'], featured: true, bestseller: true, newArrival: true,
    inventory: { M: 11, L: 7, XL: 4 },
  },
];

export function colorHex(name, swatches = {}) {
  const selected = swatches?.[name];
  if (typeof selected === 'string' && /^#[0-9a-f]{6}$/i.test(selected)) return selected;
  if (typeof name === 'string' && /^#[0-9a-f]{6}$/i.test(name)) return name;
  return COLOR_HEX[name] || '#999';
}

export function getProductBySlug(slug) {
  return products.find((p) => p.slug === slug);
}

export function stockFor(product, size) {
  return product.inventory?.[size] ?? 0;
}

export function isInStock(product) {
  return Object.values(product.inventory || {}).some((n) => n > 0);
}
