// Navigation data — mirrors the live Nuvanti site's nav: Home, Shop,
// SUMMER '26, Men's Collection, Women's Collection.
export const mainNav = [
  { label: 'Shop', href: 'shop.html' },
  { label: "SUMMER '26", href: 'shop.html?collection=unisex' },
  { label: "Men's Collection", href: 'shop.html?collection=mens' },
  { label: "Women's Collection", href: 'shop.html?collection=womens' },
];

export const footerNav = {
  Shop: [
    { label: 'Polos', href: 'shop.html?category=polos' },
    { label: 'Tank Tops', href: 'shop.html?category=tank-tops' },
    { label: 'Sweatpants', href: 'shop.html?category=sweatpants' },
    { label: "Men's Collection", href: 'shop.html?collection=mens' },
    { label: "Women's Collection", href: 'shop.html?collection=womens' },
  ],
  Help: [
    { label: 'Track Order', href: 'track.html' },
    { label: 'Contact', href: 'contact.html' },
    { label: 'Shipping', href: 'shipping-policy.html' },
    { label: 'Returns', href: 'refund-policy.html' },
    { label: 'Size Guide', href: 'size-guide.html' },
    { label: 'FAQ', href: 'faq.html' },
  ],
  Company: [
    { label: 'About', href: 'about.html' },
    { label: 'Our Story', href: 'about.html#story' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: 'privacy-policy.html' },
    { label: 'Terms & Conditions', href: 'terms.html' },
    { label: 'Exchange & Refund Policy', href: 'refund-policy.html' },
  ],
};
