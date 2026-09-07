export const slugify = (s = "") =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function orderNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `SC-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export const publicProduct = p => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  slug: p.slug,
  description: p.description,
  category: p.category,
  brand: p.brand,
  mrp: Number(p.mrp),
  retailPrice: Number(p.retailPrice),
  wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : null,
  stock: p.stock,
  minStock: p.minStock,
  unit: p.unit,
  imageUrl: p.imageUrl,
  featured: p.featured,
  active: p.active
});
