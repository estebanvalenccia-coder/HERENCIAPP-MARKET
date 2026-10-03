export type CommerceCollectionId =
  | "plantas"
  | "semillas"
  | "jardineria"
  | "sustratos"
  | "decoracion"
  | "dulce"
  | "moda"
  | "servicios";

export type CommerceCollectionDefinition = {
  id: CommerceCollectionId;
  name: string;
  description: string;
  productType: "plant" | "seed" | "garden" | "substrate" | "decor" | "food" | "fashion" | "service";
  inventoryDefault: boolean;
  categories: Array<{ id: string; name: string }>;
};

export const COMMERCE_COLLECTIONS: CommerceCollectionDefinition[] = [
  {
    id: "plantas",
    name: "Plantas",
    description: "Plantas de interior y exterior, cactus, suculentas, orquídeas y especies exóticas.",
    productType: "plant",
    inventoryDefault: true,
    categories: [
      { id: "plantas-interior", name: "Plantas de interior" },
      { id: "plantas-exterior", name: "Plantas de exterior" },
      { id: "cactus-suculentas", name: "Cactus y suculentas" },
      { id: "orquideas", name: "Orquídeas" },
      { id: "plantas-exoticas", name: "Plantas exóticas" },
      { id: "flores", name: "Flores y ramos" },
    ],
  },
  {
    id: "semillas",
    name: "Semillas",
    description: "Semillas de flores, huerto y aromáticas.",
    productType: "seed",
    inventoryDefault: true,
    categories: [
      { id: "semillas-flores", name: "Flores" },
      { id: "semillas-huerto", name: "Huerto" },
      { id: "semillas-aromaticas", name: "Aromáticas" },
      { id: "semillas-otros", name: "Otras semillas" },
    ],
  },
  {
    id: "jardineria",
    name: "Jardinería",
    description: "Herramientas, riego, fertilizantes y accesorios.",
    productType: "garden",
    inventoryDefault: true,
    categories: [
      { id: "herramientas", name: "Herramientas" },
      { id: "riego", name: "Riego" },
      { id: "fertilizantes", name: "Fertilizantes" },
      { id: "accesorios-jardin", name: "Accesorios" },
    ],
  },
  {
    id: "sustratos",
    name: "Tierra y sustratos",
    description: "Tierra, sustratos, abonos y mezclas.",
    productType: "substrate",
    inventoryDefault: true,
    categories: [
      { id: "tierra-universal", name: "Tierra universal" },
      { id: "sustratos-especiales", name: "Sustratos especiales" },
      { id: "abonos", name: "Abonos" },
      { id: "drenaje", name: "Drenaje y complementos" },
    ],
  },
  {
    id: "decoracion",
    name: "Decoración",
    description: "Macetas, jarrones, hogar, regalos y objetos decorativos.",
    productType: "decor",
    inventoryDefault: true,
    categories: [
      { id: "macetas", name: "Macetas" },
      { id: "jarrones", name: "Jarrones" },
      { id: "hogar", name: "Hogar" },
      { id: "regalos", name: "Regalos" },
      { id: "decoracion-otros", name: "Otros" },
    ],
  },
  {
    id: "dulce",
    name: "Dulce",
    description: "Tartas, postres, desayunos y detalles dulces.",
    productType: "food",
    inventoryDefault: true,
    categories: [
      { id: "tartas", name: "Tartas" },
      { id: "postres", name: "Postres" },
      { id: "desayunos", name: "Desayunos" },
      { id: "galletas", name: "Galletas" },
      { id: "detalles-dulces", name: "Detalles dulces" },
    ],
  },
  {
    id: "moda",
    name: "Moda",
    description: "Ropa, delantales, tote bags y accesorios.",
    productType: "fashion",
    inventoryDefault: true,
    categories: [
      { id: "camisetas", name: "Camisetas" },
      { id: "sudaderas", name: "Sudaderas" },
      { id: "delantales", name: "Delantales" },
      { id: "tote-bags", name: "Tote bags" },
      { id: "accesorios-moda", name: "Accesorios" },
    ],
  },
  {
    id: "servicios",
    name: "Servicios",
    description: "Jardinería, mantenimiento, decoración, limpieza, diseño floral y asesorías.",
    productType: "service",
    inventoryDefault: false,
    categories: [
      { id: "servicio-jardineria", name: "Jardinería" },
      { id: "mantenimiento", name: "Mantenimiento" },
      { id: "decoracion-eventos", name: "Decoración de espacios y eventos" },
      { id: "limpieza", name: "Limpieza" },
      { id: "diseno-floral", name: "Diseño floral" },
      { id: "asesoria", name: "Asesoría" },
    ],
  },
];

export function getCommerceCollection(id: unknown) {
  const value = String(id || "").trim().toLowerCase();
  return COMMERCE_COLLECTIONS.find((item) => item.id === value) || COMMERCE_COLLECTIONS[0];
}

export function productTypeForCollection(id: unknown) {
  return getCommerceCollection(id).productType;
}

export function primaryCollectionOf(product: any): CommerceCollectionId {
  const explicit = Array.isArray(product?.collections)
    ? product.collections.map((value: unknown) => String(value || "").toLowerCase())
    : [];
  const legacy = String(product?.collection || "").toLowerCase();
  const category = String(product?.category || "").toLowerCase();

  const direct = COMMERCE_COLLECTIONS.find((item) => explicit.includes(item.id) || legacy === item.id);
  if (direct) return direct.id;

  const byCategory = COMMERCE_COLLECTIONS.find((item) => item.categories.some((row) => row.id === category));
  return byCategory?.id || "plantas";
}

export function productBelongsToCollection(product: any, collection: string) {
  const id = String(collection || "").toLowerCase();
  if (!id || id === "todos") return true;
  const explicit = Array.isArray(product?.collections)
    ? product.collections.map((value: unknown) => String(value || "").toLowerCase())
    : [];
  return explicit.includes(id) || primaryCollectionOf(product) === id;
}

export function categoryLabel(collectionId: unknown, categoryId: unknown) {
  const collection = getCommerceCollection(collectionId);
  return collection.categories.find((item) => item.id === String(categoryId || ""))?.name || String(categoryId || "");
}

export function isPlantLikeCollection(id: unknown) {
  return ["plantas", "semillas"].includes(String(id || ""));
}

export function isPlantCareProduct(product: any) {
  const declaredCollection = String(product?.collection || "").trim().toLowerCase();
  const collection = COMMERCE_COLLECTIONS.some((item) => item.id === declaredCollection)
    ? declaredCollection
    : primaryCollectionOf(product);
  const category = String(product?.category || "").trim().toLowerCase();
  return collection === "plantas" && category !== "flores";
}

export function isServiceCollection(id: unknown) {
  return String(id || "") === "servicios";
}
