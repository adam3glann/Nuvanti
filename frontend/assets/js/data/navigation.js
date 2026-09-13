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
    { label: 'Contact', href: 'contact.html' },
    { label: 'Shipping', href: 'faq.html#shipping' },
    { label: 'Returns', href: 'faq.html#returns' },
    { label: 'Size Guide', href: 'size-guide.html' },
    { label: 'FAQ', href: 'faq.html' },
  ],
  Company: [
    { label: 'About', href: 'about.html' },
    { label: 'Our Story', href: 'about.html#story' },
    { label: 'Contact', href: 'contact.html' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
};
