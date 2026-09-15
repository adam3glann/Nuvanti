export function toPublicProduct(row) {
  const meta = row.metadata || {};
  return {
    id: String(row.id), slug: row.slug, name: row.name, description: row.description,
    price: Number(row.price_cents) / 100, priceCents: Number(row.price_cents),
    category: row.category, collection: row.collection, images: row.images || [],
    colors: row.colors || [], sizes: row.sizes || [],
    inventory: meta.inventory || { 'One Size': Number(row.inventory) },
    badges: meta.badges || [], featured: Boolean(meta.featured), bestseller: Boolean(meta.bestseller),
    newArrival: Boolean(meta.newArrival), sku: meta.sku || `NV-${row.id}`,
    compareAtPrice: meta.compareAtPrice || null, status: row.is_active ? 'active' : 'draft',
  };
}

export function productPayload(input) {
  const inventory = input.inventory && typeof input.inventory === 'object' && !Array.isArray(input.inventory)
    ? input.inventory : { 'One Size': Number(input.inventory || 0) };
  const stock = Object.values(inventory).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return {
    slug: input.slug, name: input.name, description: input.description || '',
    priceCents: Math.round(Number(input.price ?? input.priceCents) * (input.priceCents === undefined ? 100 : 1)),
    category: input.category, collection: input.collection || null, images: input.images || [],
    colors: input.colors || [], sizes: input.sizes || [], inventory: stock,
    isActive: input.status ? input.status === 'active' : input.isActive !== false,
    metadata: { inventory, badges: input.badges || [], featured: Boolean(input.featured), bestseller: Boolean(input.bestseller), newArrival: Boolean(input.newArrival), sku: input.sku || null, compareAtPrice: input.compareAtPrice || null },
  };
}
