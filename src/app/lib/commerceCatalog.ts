import { backendApi, backendStorage } from "./backendStorage";

export async function loadCommerceCatalog(options?: { collection?: string; includeArchived?: boolean }) {
  try {
    const result = await backendApi.listCommerceProducts(options);
    if (Array.isArray(result.products)) return result.products;
  } catch (error) {
    console.warn("Commerce Core no disponible, usando caché legacy", error);
  }
  try {
    const cached = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
    if (!Array.isArray(cached)) return [];
    const active = options?.includeArchived ? cached : cached.filter((item:any)=>item.active!==false&&!item.deletedAt);
    if (!options?.collection) return active;
    return active.filter((item:any)=>Array.isArray(item.collections) && item.collections.includes(options.collection));
  } catch {
    return [];
  }
}

export async function loadCommerceProduct(id: string | number) {
  try {
    const result = await backendApi.getCommerceProduct(id);
    if (result?.product) return result.product;
  } catch (error) {
    console.warn("Commerce product API no disponible, usando caché legacy", error);
  }
  const rows = await loadCommerceCatalog({ includeArchived: false });
  return rows.find((item:any)=>String(item.id)===String(id)) || null;
}
