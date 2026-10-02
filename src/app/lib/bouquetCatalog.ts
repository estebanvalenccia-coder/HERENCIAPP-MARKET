export type BouquetCatalogItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  active: boolean;
  previewColor: string;
  sortOrder: number;
};

export const BOUQUET_CATALOG_KEY = "bouquetCatalog";

export const defaultBouquetCatalog: BouquetCatalogItem[] = [
  { id: "rosa-roja", name: "Rosa Roja", price: 1.8, category: "Rosas", active: true, previewColor: "#c92d45", sortOrder: 10 },
  { id: "rosa-blanca", name: "Rosa Blanca", price: 1.8, category: "Rosas", active: true, previewColor: "#f5f1e8", sortOrder: 20 },
  { id: "rosa-rosa", name: "Rosa Rosa", price: 1.8, category: "Rosas", active: true, previewColor: "#ef8ca7", sortOrder: 30 },
  { id: "tulipan", name: "Tulipán", price: 1.5, category: "Tulipanes", active: true, previewColor: "#e9577e", sortOrder: 40 },
  { id: "lirio", name: "Lirio Blanco", price: 2.2, category: "Lirios", active: true, previewColor: "#f5f2e9", sortOrder: 50 },
  { id: "girasol", name: "Girasol", price: 2.0, category: "Girasoles", active: true, previewColor: "#f2c94c", sortOrder: 60 },
  { id: "paniculata", name: "Paniculata", price: 0.6, category: "Verdes y relleno", active: true, previewColor: "#f8f5ec", sortOrder: 70 },
  { id: "eucalipto", name: "Eucalipto", price: 1.2, category: "Verdes y relleno", active: true, previewColor: "#668f78", sortOrder: 80 },
];

function cleanItem(item: any, index: number): BouquetCatalogItem | null {
  const id = String(item?.id || "").trim();
  const name = String(item?.name || "").trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    price: Math.max(0, Number(item?.price || 0)),
    category: String(item?.category || "Otros").trim() || "Otros",
    active: item?.active !== false,
    previewColor: /^#[0-9a-f]{6}$/i.test(String(item?.previewColor || ""))
      ? String(item.previewColor)
      : "#d7b6c7",
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : (index + 1) * 10,
  };
}

export function parseBouquetCatalog(raw: string | null | undefined): BouquetCatalogItem[] {
  if (raw == null || raw === "") return defaultBouquetCatalog.map((item) => ({ ...item }));

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultBouquetCatalog.map((item) => ({ ...item }));

    return parsed
      .map(cleanItem)
      .filter(Boolean)
      .sort((a, b) => (a as BouquetCatalogItem).sortOrder - (b as BouquetCatalogItem).sortOrder) as BouquetCatalogItem[];
  } catch {
    return defaultBouquetCatalog.map((item) => ({ ...item }));
  }
}

export function serializeBouquetCatalog(items: BouquetCatalogItem[]) {
  return JSON.stringify(
    items.map((item, index) => ({
      id: item.id,
      name: item.name.trim(),
      price: Math.max(0, Number(item.price || 0)),
      category: item.category.trim() || "Otros",
      active: item.active !== false,
      previewColor: item.previewColor || "#d7b6c7",
      sortOrder: (index + 1) * 10,
    }))
  );
}
