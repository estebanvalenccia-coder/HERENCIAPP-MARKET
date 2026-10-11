// Aggregate wishlist demand without returning any customer identifiers.
// The endpoint using this function must enforce the existing admin session.
export function aggregateWishlistInterest(accounts = [], products = []) {
  const catalog = new Map((Array.isArray(products) ? products : [])
    .filter(p => p && p.id != null && !p.deletedAt && p.active !== false && String(p.status || "active") !== "archived")
    .map(p => [String(p.id), p]));
  const counts = new Map();
  for (const account of Array.isArray(accounts) ? accounts : []) {
    const ids = Array.isArray(account?.wishlist) ? account.wishlist : [];
    for (const id of new Set(ids.map(value => String(value || "").trim()).filter(Boolean))) {
      if (!catalog.has(id)) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  const items = [...counts].map(([id, count]) => {
    const p = catalog.get(id);
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const tracked = p.trackInventory !== false;
    const outOfStock = tracked && (variants.length > 0
      ? variants.every(v => Number(v?.stock || 0) <= 0)
      : Number.isFinite(Number(p.stock)) && Number(p.stock) <= 0);
    return { productId: id, name: String(p.name || p.title || "Producto"), count, outOfStock };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 100);
  return { items, totalFavorites: [...counts.values()].reduce((sum, n) => sum + n, 0), distinctProducts: counts.size };
}
