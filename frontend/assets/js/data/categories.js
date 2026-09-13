// Category data — maps to a future `categories` table/collection.
// These three match the actual current Nuvanti catalog: polos, tank
// tops, and sweatpants. Add categories here as new product types launch.
export const categories = [
  {
    slug: 'polos',
    name: 'Polos',
    image: 'assets/img/lifestyle/category-polos.webp',
  },
  {
    slug: 'tank-tops',
    name: 'Tank Tops',
    image: 'assets/img/lifestyle/category-tanktops.webp',
  },
  {
    slug: 'sweatpants',
    name: 'Sweatpants',
    image: 'assets/img/lifestyle/category-sweatpants.webp',
  },
];

export const collections = [
  { slug: 'mens', name: "Men's Collection" },
  { slug: 'womens', name: "Women's Collection" },
  { slug: 'unisex', name: 'Unisex' },
];
