export function toPublicProduct(row) {
  const meta = row.metadata || {};
  const variantInventory = meta.inventory && Object.keys(meta.inventory).length
    ? meta.inventory
    : { 'One Size': Number(row.inventory) };
  const variantColors = (row.colors || []).length ? row.colors : ['Default'];
  const variantSizes = (row.sizes || []).length ? row.sizes : ['One Size'];
  const inventoryByVariant = Object.fromEntries(variantColors.flatMap((color, index) => variantSizes.map((size) => [
    `${color}::${size}`,
    Number(meta.inventoryByVariant?.[`${color}::${size}`] ?? (index === 0 ? variantInventory[size] : 0) ?? 0),
  ])));
  return {
    id: String(row.id), slug: row.slug, name: row.name, description: row.description,
    price: Number(row.price_cents) / 100, priceCents: Number(row.price_cents),
    category: row.category, collection: row.collection, images: row.images || [],
    colors: row.colors || [], colorSwatches: meta.colorSwatches || {}, colorImages: meta.colorImages || {}, sizes: row.sizes || [],
    inventory: variantInventory,
    inventoryByVariant,
    sizeGuide: meta.sizeGuide || '', sizeGuideImage: meta.sizeGuideImage || '',
    sizeGuideMeasurements: meta.sizeGuideMeasurements || { columns: [], rows: [] },
    badges: meta.badges || [], featured: Boolean(meta.featured), bestseller: Boolean(meta.bestseller),
    newArrival: Boolean(meta.newArrival), sku: meta.sku || `NV-${row.id}`,
    compareAtPrice: meta.compareAtPrice || null, status: row.is_active ? 'active' : 'draft',
  };
}

// Product costs are private business data; expose them only on admin catalog APIs.
export function toAdminProduct(row) {
  const product = toPublicProduct(row);
  const costCents = row.metadata?.costCents;
  return { ...product, cost: costCents == null ? null : Number(costCents) / 100 };
}

export function productPayload(input) {
  const inventory = input.inventory && typeof input.inventory === 'object' && !Array.isArray(input.inventory)
    ? input.inventory : { 'One Size': Number(input.inventory || 0) };
  const stock = Object.values(inventory).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const variantColors = input.colors?.length ? input.colors : ['Default'];
  const variantSizes = input.sizes?.length ? input.sizes : ['One Size'];
  const inventoryByVariant = input.inventoryByVariant && typeof input.inventoryByVariant === 'object'
    && Object.keys(input.inventoryByVariant).length
    ? input.inventoryByVariant
    : Object.fromEntries(variantColors.flatMap((color, index) => variantSizes.map((size) => [
      `${color}::${size}`, index === 0 ? Number(inventory[size] || 0) : 0,
    ])));
  const validVariantKeys = new Set(variantColors.flatMap((color) => variantSizes.map((size) => `${color}::${size}`)));
  const filteredInventoryByVariant = Object.fromEntries([...validVariantKeys].map((key) => [key, Math.max(0, Number(inventoryByVariant[key]) || 0)]));
  const stockTotal = Object.keys(filteredInventoryByVariant).length
    ? Object.values(filteredInventoryByVariant).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
    : stock;
  return {
    slug: input.slug, name: input.name, description: input.description || '',
    priceCents: Math.round(Number(input.price ?? input.priceCents) * (input.priceCents === undefined ? 100 : 1)),
    category: input.category, collection: input.collection || null, images: input.images || [],
    colors: input.colors || [], sizes: input.sizes || [], inventory: stockTotal,
    isActive: input.status ? input.status === 'active' : input.isActive !== false,
    metadata: { inventory, inventoryByVariant: filteredInventoryByVariant, sizeGuide: input.sizeGuide || '', sizeGuideImage: input.sizeGuideImage || '', sizeGuideMeasurements: input.sizeGuideMeasurements || { columns: [], rows: [] }, colorSwatches: input.colorSwatches || {}, colorImages: Object.fromEntries((input.colors || []).filter((color) => Array.isArray(input.colorImages?.[color]) && input.colorImages[color].length).map((color) => [color, input.colorImages[color]])), badges: input.badges || [], featured: Boolean(input.featured), bestseller: Boolean(input.bestseller), newArrival: Boolean(input.newArrival), sku: input.sku || null, compareAtPrice: input.compareAtPrice || null, costCents: input.cost == null || input.cost === '' ? null : Math.round(Number(input.cost) * 100) },
  };
}
