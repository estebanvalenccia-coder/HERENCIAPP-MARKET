import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Edit,
  Eye,
  EyeOff,
  Printer,
  Search,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";
import { buildPlantProfilePublishPatch } from "../../lib/plantProfile";
import {
  COMMERCE_COLLECTIONS,
  getCommerceCollection,
  isPlantCareProduct,
  primaryCollectionOf,
  productBelongsToCollection,
  productTypeForCollection,
} from "../../lib/commerceCatalog";

type Product = {
  id: string | number;
  name: string;
  description?: string;
  category?: string;
  collections?: string[];
  type?: string;
  price?: number;
  salePrice?: number;
  compareAtPrice?: number;
  originalPrice?: number;
  onSale?: boolean;
  cost?: number;
  image?: string;
  images?: any[];
  sku?: string;
  barcode?: string;
  stock?: number;
  trackInventory?: boolean;
  iva?: number;
  taxRate?: number;
  status?: string;
  active?: boolean;
  featured?: boolean;
  deletedAt?: string;
  environment?: string;
  light?: string;
  size?: string;
  difficulty?: string;
  petSafe?: boolean;
  toxicity?: string;
  water?: string;
  temperature?: string;
  scientificName?: string;
  allowDedication?: boolean;
  variants?: Array<{ name: string; price?: number; stock?: number; sku?: string; image?: string }>;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[] | string;
  [key: string]: any;
};

function buildProductImagePrompt(product: Product, customPrompt: string) {
  const idea = customPrompt.trim() || `${product.name}. ${product.description || ""}`;
  const collection = getCommerceCollection(primaryCollectionOf(product)).name;

  return `Crea una fotografía comercial premium para Herencia Market.
Artículo: ${idea}
Colección: ${collection}.
Estilo: ecommerce elegante, natural, contemporáneo, iluminación cuidada, producto protagonista, fondo limpio y coherente con la categoría, alta calidad, sin texto, sin logos y sin marcas de agua.`;
}

async function generateProductImageWithGemini(product: Product, customPrompt: string) {
  const response = await fetch("/api/admin/ai/product-image", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: buildProductImagePrompt(product, customPrompt) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "No se pudo generar la imagen");
  if (!data?.image) throw new Error("La IA no devolvió una imagen");
  return String(data.image);
}

const emptyEdit = {
  name: "",
  description: "",
  collection: "plantas",
  category: "plantas-interior",
  image: "",
  price: 0,
  salePrice: 0,
  onSale: false,
  cost: 0,
  sku: "",
  barcode: "",
  stock: 0,
  trackInventory: true,
  iva: 21,
  status: "active",
  featured: false,
  scientificName: "",
  environment: "interior",
  light: "indirecta",
  size: "",
  difficulty: "Fácil",
  petSafe: false,
  toxicity: "",
  water: "",
  temperature: "",
  allowDedication: true,
  tags: "",
  seoTitle: "",
  seoDescription: "",
};

type EditVariant = {
  id: string;
  name: string;
  price: string;
  stock: string;
  sku: string;
  image: string;
};

function makeEditVariant(): EditVariant {
  return {
    id: `edit-variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    price: "",
    stock: "0",
    sku: "",
    image: "",
  };
}

export function AdminProducts({ onAddNew }: { onAddNew: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyEdit });
  const [editExtraCollections, setEditExtraCollections] = useState<string[]>([]);
  const [collectionOptions, setCollectionOptions] = useState<any[]>(
    COMMERCE_COLLECTIONS.map((item) => ({ id: item.id, name: item.name, status: "active" }))
  );
  const [editRelatedIds, setEditRelatedIds] = useState<string[]>([]);
  const [relatedSearch, setRelatedSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editVariants, setEditVariants] = useState<EditVariant[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [profileGenerating, setProfileGenerating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPricePercent, setBulkPricePercent] = useState("");
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState("");
  const [bulkStockValue, setBulkStockValue] = useState("");
  const [bulkTaxValue, setBulkTaxValue] = useState("");
  const [bulkSupplier, setBulkSupplier] = useState("");

  async function loadProducts() {
    try {
      setLoading(true);
      const [productResult, collectionResult] = await Promise.all([
        backendApi.listCommerceProducts({ includeArchived: true }),
        backendApi.listCommerceCollections({ includeArchived: true }),
      ]);
      const rows = Array.isArray(productResult.products) ? productResult.products : [];
      const collections = Array.isArray(collectionResult.collections)
        ? collectionResult.collections
        : [];
      setProducts(rows);
      if (collections.length) setCollectionOptions(collections);
      backendStorage.setCachedItem("adminProducts", JSON.stringify(rows));
    } catch (error) {
      try {
        const cached = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
        setProducts(Array.isArray(cached) ? cached : []);
      } catch {
        setProducts([]);
      }
      console.error(error);
      toast.error("No se pudo actualizar el catálogo desde Neon");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const archived = product.status === "archived" || Boolean(product.deletedAt);
      if (showTrash !== archived) return false;
      if (collectionFilter !== "todos" && !productBelongsToCollection(product, collectionFilter)) return false;
      if (!query) return true;
      return [product.name, product.description, product.sku, product.category, primaryCollectionOf(product)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [products, showTrash, collectionFilter, search]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.includes(String(product.id))),
    [products, selectedIds]
  );

  function toggleSelected(id: string | number) {
    const key = String(id);
    setSelectedIds((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function selectVisible() {
    const ids = visibleProducts.map((product) => String(product.id));
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current, ...ids]))
    );
  }

  async function bulkUpdate(payload: any, message: string) {
    if (!selectedProducts.length) return;
    try {
      setLoading(true);
      const publishing = payload?.status === "active" || payload?.active === true;
      const prepared = await Promise.all(
        selectedProducts.map(async (product) => {
          if (!publishing) return { product, payload };
          const aiPatch = await buildPlantProfilePublishPatch({ ...product, ...payload });
          return {
            product,
            payload: {
              ...payload,
              ...aiPatch,
              metadata: {
                ...(payload?.metadata || {}),
                ...((aiPatch as any).metadata || {}),
              },
            },
          };
        })
      );
      await Promise.all(
        prepared.map(({ product, payload: nextPayload }) =>
          backendApi.updateCommerceProduct(product.id, nextPayload)
        )
      );
      setSelectedIds([]);
      await loadProducts();
      toast.success(message);
    } catch (error: any) {
      toast.error(
        error?.message
          ? `No se pudieron publicar/actualizar los artículos: ${error.message}`
          : "No se pudieron actualizar los artículos"
      );
    } finally {
      setLoading(false);
    }
  }

  async function bulkTransform(transform: (product: Product) => any, message: string) {
    if (!selectedProducts.length) return;
    try {
      setLoading(true);
      await Promise.all(selectedProducts.map((product) => backendApi.updateCommerceProduct(product.id, transform(product))));
      await loadProducts();
      toast.success(message);
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron actualizar los artículos");
    } finally {
      setLoading(false);
    }
  }

  async function applyBulkPricePercent() {
    const percent = Number(bulkPricePercent);
    if (!Number.isFinite(percent) || percent === 0) return toast.error("Escribe un porcentaje distinto de 0");
    if (percent <= -100) return toast.error("El porcentaje no puede reducir el precio a 0 o menos");
    await bulkTransform((product) => {
      const regular = Math.max(0.01, Number(product.price || 0));
      const next = Math.max(0.01, Math.round(regular * (1 + percent / 100) * 100) / 100);
      const payload: any = { price: next };
      if (product.onSale && product.salePrice) {
        const sale = Math.max(0.01, Math.round(Number(product.salePrice) * (1 + percent / 100) * 100) / 100);
        payload.salePrice = Math.min(sale, Math.max(0.01, next - 0.01));
        payload.compareAtPrice = next;
        payload.onSale = true;
      }
      return payload;
    }, "Precios actualizados");
    setBulkPricePercent("");
  }

  async function applyBulkDiscount() {
    const percent = Number(bulkDiscountPercent);
    if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) return toast.error("El descuento debe estar entre 1% y 99%");
    await bulkTransform((product) => {
      const regular = Math.max(0.01, Number(product.price || 0));
      const sale = Math.max(0.01, Math.round(regular * (1 - percent / 100) * 100) / 100);
      return { price: regular, salePrice: sale, compareAtPrice: regular, onSale: true };
    }, "Descuento aplicado");
    setBulkDiscountPercent("");
  }

  async function applyBulkStock() {
    const stock = Number(bulkStockValue);
    if (!Number.isFinite(stock) || stock < 0) return toast.error("Escribe un stock válido");
    await bulkTransform((product) => product.trackInventory === false ? {} : { stock: Math.max(0, Math.floor(stock)) }, "Stock actualizado");
    setBulkStockValue("");
  }

  async function applyBulkTax() {
    const tax = Number(bulkTaxValue);
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) return toast.error("Escribe un IVA entre 0 y 100");
    await bulkTransform(() => ({ taxRate: tax, iva: tax }), "IVA actualizado");
    setBulkTaxValue("");
  }

  async function applyBulkSupplier() {
    const supplier = bulkSupplier.trim();
    if (!supplier) return toast.error("Escribe el proveedor");
    await bulkTransform((product) => ({ metadata: { ...(product.metadata || {}), supplierId: supplier } }), "Proveedor actualizado");
    setBulkSupplier("");
  }
  async function bulkArchive() {
    if (!selectedProducts.length) return;
    if (!confirm(`¿Mover ${selectedProducts.length} artículos a la papelera?`)) return;
    try {
      setLoading(true);
      await Promise.all(
        selectedProducts.map((product) => backendApi.deleteCommerceProduct(product.id, false))
      );
      setSelectedIds([]);
      await loadProducts();
      toast.success("Artículos movidos a la papelera");
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron archivar los artículos");
    } finally {
      setLoading(false);
    }
  }

  async function moveProduct(product: Product, direction: -1 | 1) {
    const collection = primaryCollectionOf(product);
    const rows = products.filter(
      (item) =>
        primaryCollectionOf(item) === collection &&
        item.status !== "archived" &&
        !item.deletedAt
    );
    const index = rows.findIndex((item) => String(item.id) === String(product.id));
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) return;

    const target = rows[targetIndex];
    const productOrder = Number.isFinite(Number(product.sortOrder))
      ? Number(product.sortOrder)
      : index * 10;
    const targetOrder = Number.isFinite(Number(target.sortOrder))
      ? Number(target.sortOrder)
      : targetIndex * 10;

    try {
      await Promise.all([
        backendApi.updateCommerceProduct(product.id, { sortOrder: targetOrder }),
        backendApi.updateCommerceProduct(target.id, { sortOrder: productOrder }),
      ]);
      await loadProducts();
      toast.success("Orden actualizado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cambiar el orden");
    }
  }

  async function updateProduct(product: Product, payload: any, message?: string) {
    try {
      await backendApi.updateCommerceProduct(product.id, payload);
      await loadProducts();
      if (message) toast.success(message);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo actualizar el artículo");
    }
  }

  async function toggleActive(product: Product) {
    const active = product.status === "active" || product.active === true;
    if (active) {
      await updateProduct(
        product,
        { status: "draft", active: false },
        "Artículo pasado a borrador"
      );
      return;
    }

    try {
      const basePatch = { status: "active", active: true };
      const aiPatch = await buildPlantProfilePublishPatch({ ...product, ...basePatch });
      await updateProduct(
        product,
        {
          ...basePatch,
          ...aiPatch,
          metadata: {
            ...((aiPatch as any).metadata || {}),
          },
        },
        "Artículo publicado"
      );
    } catch (error: any) {
      toast.error(
        error?.message
          ? `No se pudo publicar la planta: ${error.message}`
          : "No se pudo generar la ficha IA de la planta"
      );
    }
  }

  async function regeneratePlantProfile(product: Product) {
    if (!isPlantCareProduct(product)) return;
    const key = String(product.id);
    try {
      setProfileGenerating(key);
      const aiPatch = await buildPlantProfilePublishPatch(product, { force: true });
      await backendApi.updateCommerceProduct(product.id, aiPatch);
      await loadProducts();
      toast.success("Ficha de planta regenerada y guardada en Neon");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo regenerar la ficha IA de la planta");
    } finally {
      setProfileGenerating(null);
    }
  }

  async function toggleSale(product: Product) {
    const regular = Number(product.price || 0);
    if (product.onSale) {
      await updateProduct(
        product,
        {
          price: regular,
          salePrice: undefined,
          compareAtPrice: null,
          onSale: false,
        },
        "Oferta desactivada"
      );
      return;
    }

    const sale = Math.round(regular * 0.8 * 100) / 100;
    await updateProduct(
      product,
      { price: regular, salePrice: sale, compareAtPrice: regular, onSale: true },
      "Oferta del 20% activada"
    );
  }

  async function archiveProduct(product: Product) {
    if (!confirm("¿Mover este artículo a la papelera?")) return;
    try {
      await backendApi.deleteCommerceProduct(product.id, false);
      await loadProducts();
      toast.success("Artículo movido a la papelera");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo archivar");
    }
  }

  async function restoreProduct(product: Product) {
    try {
      const basePatch = { status: "active", active: true, deletedAt: null };
      const aiPatch = await buildPlantProfilePublishPatch({ ...product, ...basePatch });
      await updateProduct(
        product,
        {
          ...basePatch,
          ...aiPatch,
          metadata: {
            ...((aiPatch as any).metadata || {}),
          },
        },
        "Artículo restaurado"
      );
    } catch (error: any) {
      toast.error(error?.message || "No se pudo restaurar/publicar el artículo");
    }
  }

  async function permanentlyDeleteProduct(product: Product) {
    if (!confirm("Esta acción es definitiva. ¿Eliminar permanentemente?")) return;
    try {
      await backendApi.deleteCommerceProduct(product.id, true);
      await loadProducts();
      toast.success("Artículo eliminado definitivamente");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo eliminar");
    }
  }

  async function duplicateProduct(product: Product) {
    try {
      const primary = primaryCollectionOf(product);
      const copy = {
        ...product,
        id: undefined,
        name: `${product.name} · copia`,
        sku: product.sku ? `${product.sku}-COPY` : "",
        status: "draft",
        active: false,
        deletedAt: undefined,
        plantProfile: null,
        aiPlantProfileGenerated: false,
        aiPlantProfileGeneratedAt: null,
        collections: Array.isArray(product.collections) && product.collections.length
          ? product.collections
          : [primary],
      };
      delete copy.id;
      await backendApi.createCommerceProduct(copy);
      await loadProducts();
      toast.success("Copia creada como borrador");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo duplicar");
    }
  }

  function startEdit(product: Product) {
    const collection = primaryCollectionOf(product);
    const extraCollections = Array.isArray(product.collections)
      ? product.collections.map(String).filter((id) => id && id !== collection)
      : [];
    const regularPrice = Number(product.price || 0);
    const salePrice = product.onSale ? Number(product.salePrice || 0) : 0;
    setEditingProduct(product);
    setEditExtraCollections(extraCollections);
    setAiPrompt("");

    const gallery = Array.from(new Set([
      String(product.image || "").trim(),
      ...(Array.isArray(product.images)
        ? product.images.map((image: any) => String(typeof image === "string" ? image : image?.url || "").trim())
        : []),
    ].filter(Boolean)));
    setEditImages(gallery);
    setEditVariants(
      (product.variants || []).map((variant, index) => ({
        id: `edit-variant-${product.id}-${index}`,
        name: String(variant.name || ""),
        price: variant.price == null ? "" : String(variant.price),
        stock: String(Math.max(0, Number(variant.stock || 0))),
        sku: String(variant.sku || ""),
        image: String(variant.image || ""),
      }))
    );

    setRelatedSearch("");
    setEditRelatedIds(
      Array.isArray(product.relatedProductIds)
        ? product.relatedProductIds.map(String).slice(0, 8)
        : Array.isArray(product.metadata?.relatedProductIds)
          ? product.metadata.relatedProductIds.map(String).slice(0, 8)
          : []
    );
    setEditForm({
      name: product.name || "",
      description: product.description || "",
      collection,
      category: product.category || getCommerceCollection(collection).categories[0]?.id || collection,
      image: product.image || "",
      price: regularPrice,
      salePrice,
      onSale: Boolean(product.onSale),
      cost: Number(product.cost || 0),
      sku: product.sku || "",
      barcode: product.barcode || "",
      stock: Math.max(0, Number(product.stock || 0)),
      trackInventory: product.trackInventory !== false,
      iva: Number(product.iva ?? product.taxRate ?? 21),
      status: product.status === "draft" ? "draft" : "active",
      featured: Boolean(product.featured),
      scientificName: product.scientificName || "",
      environment: product.environment || "interior",
      light: product.light || "indirecta",
      size: product.size || "",
      difficulty: product.difficulty || "Fácil",
      petSafe: Boolean(product.petSafe),
      toxicity: product.toxicity || "",
      water: product.water || "",
      temperature: product.temperature || "",
      allowDedication: product.allowDedication !== false,
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : String(product.tags || ""),
      seoTitle: product.seoTitle || product.name || "",
      seoDescription: product.seoDescription || product.description || "",
    });
  }

  function cancelEdit() {
    setEditingProduct(null);
    setEditForm({ ...emptyEdit });
    setEditExtraCollections([]);
    setEditImages([]);
    setEditVariants([]);
    setEditRelatedIds([]);
    setRelatedSearch("");
    setAiPrompt("");
  }

  async function generateAiImage() {
    if (!editingProduct) return;
    try {
      setAiGenerating(true);
      const imageUrl = await generateProductImageWithGemini(
        { ...editingProduct, name: editForm.name, description: editForm.description },
        aiPrompt
      );
      setEditForm((current) => ({ ...current, image: imageUrl }));
      setEditImages((current) => current.length ? [imageUrl, ...current.slice(1)] : [imageUrl]);
      toast.success("Imagen generada");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo generar la imagen");
    } finally {
      setAiGenerating(false);
    }
  }

  async function addGalleryFiles(files: File[]) {
    if (!files.length) return;
    const remaining = Math.max(0, 8 - editImages.length);
    if (!remaining) return toast.error("Máximo 8 imágenes por producto");

    const accepted = files.slice(0, remaining);
    for (const file of accepted) {
      if (!file.type.startsWith("image/")) return toast.error(`${file.name}: formato no válido`);
      if (file.size > 8 * 1024 * 1024) return toast.error(`${file.name}: supera 8 MB`);
    }

    try {
      setGalleryUploading(true);
      const uploadedUrls: string[] = [];
      for (const file of accepted) {
        const uploaded = await backendApi.uploadSiteMediaFile(file);
        const url = String(uploaded.media?.url || "");
        if (!url) throw new Error(`No se recibió URL para ${file.name}`);
        uploadedUrls.push(url);
      }
      setEditImages((current) => [...current, ...uploadedUrls].slice(0, 8));
      setEditForm((current) => ({ ...current, image: current.image || uploadedUrls[0] || "" }));
      toast.success(uploadedUrls.length === 1 ? "Imagen añadida" : `${uploadedUrls.length} imágenes añadidas`);
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron subir las imágenes");
    } finally {
      setGalleryUploading(false);
    }
  }

  function moveEditImage(index: number, direction: -1 | 1) {
    setEditImages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      setEditForm((form) => ({ ...form, image: next[0] || "" }));
      return next;
    });
  }

  function removeEditImage(index: number) {
    setEditImages((current) => {
      const removed = current[index];
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      setEditForm((form) => ({ ...form, image: next[0] || "" }));
      setEditVariants((variants) =>
        variants.map((variant) => variant.image === removed ? { ...variant, image: "" } : variant)
      );
      return next;
    });
  }

  function updateEditVariant(id: string, patchValue: Partial<EditVariant>) {
    setEditVariants((current) =>
      current.map((variant) => variant.id === id ? { ...variant, ...patchValue } : variant)
    );
  }

  async function saveEdit() {
    if (!editingProduct) return;
    if (!editForm.name.trim()) return toast.error("El nombre es obligatorio");
    if (editForm.price <= 0) return toast.error("El precio debe ser mayor que 0");
    if (editForm.onSale && (editForm.salePrice <= 0 || editForm.salePrice >= editForm.price)) {
      return toast.error("El precio de oferta debe ser menor que el precio normal");
    }

    try {
      setSaving(true);
      const resolvedImages: string[] = [];
      const imageMap = new Map<string, string>();
      for (let index = 0; index < editImages.length; index += 1) {
        const image = editImages[index];
        if (image.startsWith("data:image/")) {
          const uploaded = await backendApi.uploadSiteMedia({
            dataUrl: image,
            filename: `${editForm.name.replace(/[^a-z0-9]+/gi, "-") || "producto"}-${index + 1}.jpg`,
          });
          const url = String(uploaded.media?.url || "");
          if (!url) throw new Error("No se pudo guardar una imagen generada");
          resolvedImages.push(url);
          imageMap.set(image, url);
        } else if (image) {
          resolvedImages.push(image);
          imageMap.set(image, image);
        }
      }
      const imageUrl = resolvedImages[0] || "";

      const plantLike = isPlantCareProduct({ collection: editForm.collection, category: editForm.category });
      const variants = editVariants
        .filter((variant) => variant.name.trim())
        .map((variant) => ({
          name: variant.name.trim(),
          price: variant.price ? Math.max(0, Number(variant.price)) : undefined,
          stock: variant.stock ? Math.max(0, Math.floor(Number(variant.stock))) : 0,
          sku: variant.sku.trim() || undefined,
          image: variant.image ? (imageMap.get(variant.image) || variant.image) : undefined,
        }));

      const basePayload: any = {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        collection: editForm.collection,
        collections: [editForm.collection, ...editExtraCollections]
          .filter((value, index, rows) => value && rows.indexOf(value) === index),
        category: editForm.category,
        type: productTypeForCollection(editForm.collection),
        status: editForm.status,
        active: editForm.status === "active",
        featured: editForm.featured,
        price: editForm.price,
        salePrice: editForm.onSale ? editForm.salePrice : undefined,
        compareAtPrice: editForm.onSale ? editForm.price : null,
        onSale: editForm.onSale,
        cost: editForm.cost || null,
        sku: editForm.sku.trim(),
        barcode: editForm.barcode.trim(),
        stock: editForm.trackInventory ? editForm.stock : 0,
        trackInventory: editForm.trackInventory,
        taxRate: editForm.iva,
        image: imageUrl || undefined,
        images: resolvedImages,
        scientificName: plantLike ? editForm.scientificName.trim() : "",
        environment: plantLike ? editForm.environment : "",
        light: plantLike ? editForm.light : "",
        size: plantLike ? editForm.size.trim() : "",
        difficulty: plantLike ? editForm.difficulty : "",
        petSafe: plantLike ? editForm.petSafe : false,
        toxicity: plantLike ? editForm.toxicity.trim() : "",
        water: plantLike ? editForm.water.trim() : "",
        temperature: plantLike ? editForm.temperature.trim() : "",
        allowDedication: editForm.allowDedication,
        variants,
        seoTitle: editForm.seoTitle.trim() || editForm.name.trim(),
        seoDescription: editForm.seoDescription.trim() || editForm.description.trim(),
        metadata: {
          ...(editingProduct.metadata || {}),
          tags: editForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          relatedProductIds: editRelatedIds,
        },
      
        ...(plantLike
          ? {}
          : {
              plantProfile: null,
              aiPlantProfileGenerated: false,
              aiPlantProfileGeneratedAt: null,
            }),
      };

      let finalPayload = basePayload;
      if (editForm.status === "active") {
        const aiPatch = await buildPlantProfilePublishPatch({
          ...editingProduct,
          ...basePayload,
        });
        finalPayload = {
          ...basePayload,
          ...aiPatch,
          metadata: {
            ...(basePayload.metadata || {}),
            ...((aiPatch as any).metadata || {}),
          },
        };
      }

      await backendApi.updateCommerceProduct(editingProduct.id, finalPayload);

      await loadProducts();
      toast.success("Artículo actualizado en Neon");
      cancelEdit();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el artículo");
    } finally {
      setSaving(false);
    }
  }

  function printLabel(product: Product) {
    const url = `${window.location.origin}/producto/${product.id}`;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
    const popup = window.open("", "_blank", "width=520,height=700");
    if (!popup) return toast.error("El navegador bloqueó la ventana");
    const sale = product.onSale && product.salePrice ? product.salePrice : product.price;
    popup.document.write(`<!doctype html><html><head><title>${product.name}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#24352b}.label{border:2px solid #426047;border-radius:22px;padding:24px;max-width:390px;margin:auto;text-align:center}.brand{font-weight:900;letter-spacing:2px;color:#426047}.name{font-size:25px;font-weight:800;margin:14px 0}.price{font-size:28px;font-weight:900}.meta{font-size:13px;color:#66756c;margin:6px}.qr{width:170px;height:170px;margin:16px auto 6px}@media print{button{display:none}body{padding:0}}</style></head><body><div class="label"><div class="brand">HERENCIA</div><div class="name">${product.name}</div><div class="price">€${Number(sale||0).toFixed(2)}</div><div class="meta">SKU: ${product.sku||product.id}</div><img class="qr" src="${qr}" alt="QR"/><div class="meta">${url}</div></div><p style="text-align:center"><button onclick="window.print()">Imprimir etiqueta</button></p></body></html>`);
    popup.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Commerce · Neon</p>
          <h2 className="mt-1 text-3xl font-black text-foreground">Catálogo de venta</h2>
          <p className="mt-1 text-muted-foreground">
            {products.filter((product) => product.status !== "archived" && !product.deletedAt).length} activos/borradores · {products.filter((product) => product.status === "archived" || product.deletedAt).length} en papelera
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowTrash((value) => !value)} className="rounded-xl bg-muted px-4 py-3 font-bold">
            {showTrash ? "Volver al catálogo" : "Papelera"}
          </button>
          <button onClick={onAddNew} className="rounded-xl bg-primary px-6 py-3 font-black text-primary-foreground">
            + Crear artículo
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[1fr_260px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, SKU, categoría…"
            className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4"
          />
        </div>
        <select
          value={collectionFilter}
          onChange={(event) => setCollectionFilter(event.target.value)}
          className="rounded-xl border border-border bg-background px-4 py-3 font-bold"
        >
          <option value="todos">Todas las colecciones</option>
          {collectionOptions
            .filter((item) => String(item.status || "active") !== "archived")
            .map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.name || item.id)}</option>)}
        </select>
      </div>

      {!showTrash && visibleProducts.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex items-center gap-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={visibleProducts.every((product) => selectedIds.includes(String(product.id)))}
              onChange={selectVisible}
            />
            Seleccionar visibles ({visibleProducts.length})
          </label>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-black">{selectedIds.length} seleccionados</span>
              <button type="button" onClick={() => void bulkUpdate({ status: "active", active: true }, "Artículos publicados")} className="rounded-lg border border-border px-3 py-2 text-xs font-black">Publicar</button>
              <button type="button" onClick={() => void bulkUpdate({ status: "draft", active: false }, "Artículos pasados a borrador")} className="rounded-lg border border-border px-3 py-2 text-xs font-black">Borrador</button>
              <button type="button" onClick={() => void bulkUpdate({ featured: true }, "Artículos destacados")} className="rounded-lg border border-border px-3 py-2 text-xs font-black">Destacar</button>
              <button type="button" onClick={() => void bulkUpdate({ featured: false }, "Destacado retirado")} className="rounded-lg border border-border px-3 py-2 text-xs font-black">Quitar destacado</button>
              <button type="button" onClick={() => void bulkArchive()} className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-black text-destructive">Papelera</button>
              <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg px-3 py-2 text-xs font-black text-muted-foreground">Limpiar</button>
            </div>
          )}
        </div>
      )}

      {selectedIds.length > 0 && !showTrash && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-3">
            <p className="font-black">Edición masiva Pro</p>
            <p className="text-xs text-muted-foreground">Aplica cambios comerciales a los artículos seleccionados.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-border bg-background p-3">
              <label className="text-xs font-black">Precio ± %</label>
              <div className="mt-2 flex gap-2">
                <input type="number" step="0.1" value={bulkPricePercent} onChange={(e) => setBulkPricePercent(e.target.value)} placeholder="+10 / -5" className="min-w-0 flex-1 rounded-lg border border-border px-2 py-2 text-sm" />
                <button type="button" onClick={() => void applyBulkPricePercent()} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground">Aplicar</button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <label className="text-xs font-black">Descuento %</label>
              <div className="mt-2 flex gap-2">
                <input type="number" min="1" max="99" step="1" value={bulkDiscountPercent} onChange={(e) => setBulkDiscountPercent(e.target.value)} placeholder="20" className="min-w-0 flex-1 rounded-lg border border-border px-2 py-2 text-sm" />
                <button type="button" onClick={() => void applyBulkDiscount()} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground">Aplicar</button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <label className="text-xs font-black">Fijar stock</label>
              <div className="mt-2 flex gap-2">
                <input type="number" min="0" step="1" value={bulkStockValue} onChange={(e) => setBulkStockValue(e.target.value)} placeholder="10" className="min-w-0 flex-1 rounded-lg border border-border px-2 py-2 text-sm" />
                <button type="button" onClick={() => void applyBulkStock()} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground">Aplicar</button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <label className="text-xs font-black">IVA %</label>
              <div className="mt-2 flex gap-2">
                <input type="number" min="0" max="100" step="0.1" value={bulkTaxValue} onChange={(e) => setBulkTaxValue(e.target.value)} placeholder="21" className="min-w-0 flex-1 rounded-lg border border-border px-2 py-2 text-sm" />
                <button type="button" onClick={() => void applyBulkTax()} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground">Aplicar</button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <label className="text-xs font-black">Proveedor</label>
              <div className="mt-2 flex gap-2">
                <input value={bulkSupplier} onChange={(e) => setBulkSupplier(e.target.value)} placeholder="Proveedor / ID" className="min-w-0 flex-1 rounded-lg border border-border px-2 py-2 text-sm" />
                <button type="button" onClick={() => void applyBulkSupplier()} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground">Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">Cargando catálogo de Neon…</div>
      ) : visibleProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-xl font-black">No hay artículos aquí</p>
          <p className="mt-2 text-sm text-muted-foreground">Crea un producto, servicio, artículo de moda o dulce desde “Crear artículo”.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {visibleProducts.map((product) => {
            const collection = getCommerceCollection(primaryCollectionOf(product));
            const published = product.status === "active" || product.active === true;
            const salePrice = product.onSale && product.salePrice ? Number(product.salePrice) : null;
            return (
              <article key={String(product.id)} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
                <div className="grid sm:grid-cols-[180px_1fr]">
                  <div className="h-52 bg-muted sm:h-full">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full min-h-44 items-center justify-center p-5 text-center text-sm text-muted-foreground">Sin imagen</div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        {!showTrash && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(String(product.id))}
                            onChange={() => toggleSelected(product.id)}
                            className="mt-1"
                            aria-label={`Seleccionar ${product.name}`}
                          />
                        )}
                        <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">{collection.name}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {published ? "Publicado" : "Borrador"}
                          </span>
                          {product.featured && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-800">Destacado</span>}
                        </div>
                        <h3 className="text-xl font-black">{product.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                        </div>
                      </div>
                      <button onClick={() => printLabel(product)} className="rounded-lg border border-border p-2" title="Imprimir etiqueta"><Printer className="h-4 w-4" /></button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><p className="text-xs text-muted-foreground">Precio</p><p className="font-black">{salePrice ? <><span className="mr-1 text-xs line-through">€{Number(product.price||0).toFixed(2)}</span>€{salePrice.toFixed(2)}</> : `€${Number(product.price||0).toFixed(2)}`}</p></div>
                      <div><p className="text-xs text-muted-foreground">Stock</p><p className="font-black">{product.trackInventory === false ? "∞" : Math.max(0, Number(product.stock || 0))}</p></div>
                      <div><p className="text-xs text-muted-foreground">SKU</p><p className="truncate font-bold">{product.sku || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-bold">{product.type || collection.productType}</p></div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button onClick={() => void toggleActive(product)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold">
                        {published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {published ? "Pasar a borrador" : "Publicar"}
                      </button>
                      <button onClick={() => void toggleSale(product)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold">
                        <TagIcon className="h-4 w-4" /> {product.onSale ? "Quitar oferta" : "Oferta -20%"}
                      </button>
                      <button onClick={() => startEdit(product)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">
                        <Edit className="h-4 w-4" /> Editar
                      </button>
                      {isPlantCareProduct(product) && (
                        <button
                          onClick={() => void regeneratePlantProfile(product)}
                          disabled={profileGenerating === String(product.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-bold text-primary disabled:opacity-50"
                        >
                          <Sparkles className="h-4 w-4" />
                          {profileGenerating === String(product.id)
                            ? "Generando ficha…"
                            : product.plantProfile
                              ? "Regenerar ficha IA"
                              : "Generar ficha IA"}
                        </button>
                      )}
                      <button onClick={() => void duplicateProduct(product)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold">
                        <Copy className="h-4 w-4" /> Duplicar
                      </button>
                      {!showTrash && (
                        <>
                          <button onClick={() => void moveProduct(product, -1)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-sm font-bold" title="Subir en su colección">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button onClick={() => void moveProduct(product, 1)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-sm font-bold" title="Bajar en su colección">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {showTrash ? (
                        <>
                          <button onClick={() => void restoreProduct(product)} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">Restaurar</button>
                          <button onClick={() => void permanentlyDeleteProduct(product)} className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive"><Trash2 className="h-4 w-4" /> Eliminar</button>
                        </>
                      ) : (
                        <button onClick={() => void archiveProduct(product)} className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive"><Trash2 className="h-4 w-4" /> Papelera</button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Editar artículo real</p>
                <h3 className="mt-1 text-2xl font-black">{editingProduct.name}</h3>
                <p className="text-xs text-muted-foreground">Los cambios se guardan directamente en Commerce/Neon.</p>
              </div>
              <button onClick={cancelEdit} className="rounded-xl border border-border px-4 py-2 font-bold">Cerrar</button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-black">Galería</p>
                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-black">{editImages.length}/8</span>
                  </div>

                  {editImages.length > 0 ? (
                    <div className="space-y-3">
                      <div className="relative h-72 overflow-hidden rounded-2xl border border-border bg-muted">
                        <img src={editImages[0]} alt="" className="h-full w-full object-cover" />
                        <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white">Principal</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {editImages.map((image, index) => (
                          <div key={`${image}-${index}`} className="overflow-hidden rounded-xl border border-border bg-background">
                            <div className="relative aspect-square bg-muted">
                              <img src={image} alt="" className="h-full w-full object-cover" />
                              <button type="button" onClick={() => removeEditImage(index)} className="absolute right-1.5 top-1.5 rounded-full bg-black/65 p-1.5 text-white">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between gap-1 p-2">
                              <span className="text-[10px] font-black">{index === 0 ? "Principal" : `Foto ${index + 1}`}</span>
                              <div className="flex gap-1">
                                <button type="button" disabled={index === 0} onClick={() => moveEditImage(index, -1)} className="rounded border border-border px-1.5 py-0.5 text-[10px] disabled:opacity-30">←</button>
                                <button type="button" disabled={index === editImages.length - 1} onClick={() => moveEditImage(index, 1)} className="rounded border border-border px-1.5 py-0.5 text-[10px] disabled:opacity-30">→</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">Sin imágenes</div>
                  )}
                </div>

                {editImages.length < 8 && (
                  <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-3 text-xs font-black">
                    <Upload className="h-4 w-4" /> {galleryUploading ? "Subiendo…" : "Añadir fotos"}
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      disabled={galleryUploading}
                      onChange={(event) => {
                        const input = event.currentTarget;
                        void addGalleryFiles(Array.from(input.files || [])).finally(() => { input.value = ""; });
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                )}

                <label className="block text-sm font-bold">Prompt de imagen IA
                  <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <button onClick={() => void generateAiImage()} disabled={aiGenerating} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground disabled:opacity-60">
                  <Sparkles className="h-4 w-4" /> {aiGenerating ? "Generando…" : "Generar imagen principal con IA"}
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2 text-sm font-bold">Nombre
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                  <label className="sm:col-span-2 text-sm font-bold">Descripción
                    <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={4} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3" />
                  </label>

                  <label className="text-sm font-bold">Colección
                    <select
                      value={editForm.collection}
                      onChange={(e) => {
                        const next = getCommerceCollection(e.target.value);
                        setEditForm({ ...editForm, collection: next.id, category: next.categories[0]?.id || next.id, trackInventory: next.inventoryDefault });
                      }}
                      className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                    >
                      {COMMERCE_COLLECTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold">Subcategoría
                    <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3">
                      {getCommerceCollection(editForm.collection).categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>

                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm font-bold">También mostrar en otras colecciones</p>
                    <div className="flex flex-wrap gap-2">
                      {collectionOptions
                        .filter((item) => String(item.status || "active") === "active" && String(item.id) !== editForm.collection)
                        .map((item) => {
                          const id = String(item.id);
                          const checked = editExtraCollections.includes(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() =>
                                setEditExtraCollections((current) =>
                                  current.includes(id)
                                    ? current.filter((value) => value !== id)
                                    : [...current, id]
                                )
                              }
                              className={`rounded-full border px-3 py-2 text-xs font-bold ${
                                checked ? "border-primary bg-primary/10 text-primary" : "border-border"
                              }`}
                            >
                              {checked ? "✓ " : ""}{String(item.name || id)}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <label className="text-sm font-bold">Precio normal (€)
                    <input type="number" min="0" step="0.01" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value || 0) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                  <label className="text-sm font-bold">Coste (€)
                    <input type="number" min="0" step="0.01" value={editForm.cost} onChange={(e) => setEditForm({ ...editForm, cost: Number(e.target.value || 0) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditForm({ ...editForm, onSale: !editForm.onSale })} className={`rounded-xl border px-4 py-2 text-sm font-bold ${editForm.onSale ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{editForm.onSale ? "✓ En oferta" : "Activar oferta"}</button>
                  <button type="button" onClick={() => setEditForm({ ...editForm, featured: !editForm.featured })} className={`rounded-xl border px-4 py-2 text-sm font-bold ${editForm.featured ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{editForm.featured ? "✓ Destacado" : "Destacar"}</button>
                </div>

                {editForm.onSale && <label className="block max-w-xs text-sm font-bold">Precio de oferta (€)
                  <input type="number" min="0" step="0.01" value={editForm.salePrice} onChange={(e) => setEditForm({ ...editForm, salePrice: Number(e.target.value || 0) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                </label>}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm font-bold">SKU
                    <input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                  </label>
                  <label className="text-sm font-bold">Código barras
                    <input value={editForm.barcode} onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                  </label>
                  <label className="text-sm font-bold">Stock
                    <input type="number" min="0" disabled={!editForm.trackInventory} value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: Math.max(0, Number(e.target.value || 0)) })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 disabled:opacity-50" />
                  </label>
                  <label className="text-sm font-bold">IVA
                    <input type="number" min="0" step="0.01" value={editForm.iva} onChange={(e) => setEditForm({ ...editForm, iva: Math.max(0, Number(e.target.value || 0)) })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">Estado
                    <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3">
                      <option value="active">Publicado</option><option value="draft">Borrador</option>
                    </select>
                  </label>
                  <label className="mt-7 flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={editForm.trackInventory} disabled={editForm.collection === "servicios"} onChange={(e) => setEditForm({ ...editForm, trackInventory: e.target.checked })} />
                    Controlar inventario
                  </label>
                </div>

                {isPlantCareProduct({ collection: editForm.collection, category: editForm.category }) && (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <h4 className="font-black">Cuidados / ficha de planta</h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <input value={editForm.scientificName} onChange={(e) => setEditForm({ ...editForm, scientificName: e.target.value })} placeholder="Nombre científico" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <select value={editForm.environment} onChange={(e) => setEditForm({ ...editForm, environment: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-3"><option value="interior">Interior</option><option value="exterior">Exterior</option><option value="interior exterior">Interior/exterior</option></select>
                      <select value={editForm.light} onChange={(e) => setEditForm({ ...editForm, light: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-3"><option value="baja">Poca luz</option><option value="indirecta">Indirecta</option><option value="sol">Sol</option></select>
                      <input value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} placeholder="Tamaño" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <input value={editForm.water} onChange={(e) => setEditForm({ ...editForm, water: e.target.value })} placeholder="Riego" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <input value={editForm.temperature} onChange={(e) => setEditForm({ ...editForm, temperature: e.target.value })} placeholder="Temperatura" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <input value={editForm.toxicity} onChange={(e) => setEditForm({ ...editForm, toxicity: e.target.value })} placeholder="Toxicidad" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <select value={editForm.difficulty} onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-3"><option>Fácil</option><option>Media</option><option>Avanzada</option></select>
                    </div>
                    <button type="button" onClick={() => setEditForm({ ...editForm, petSafe: !editForm.petSafe })} className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold ${editForm.petSafe ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>🐾 {editForm.petSafe ? "Apta para mascotas" : "Marcar apta para mascotas"}</button>
                  </div>
                )}

                <div className="rounded-2xl border border-border p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">Variantes</p>
                      <p className="text-xs text-muted-foreground">Tallas, colores, tamaños, sabores o packs.</p>
                    </div>
                    <button type="button" onClick={() => setEditVariants((current) => [...current, makeEditVariant()])} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground">+ Variante</button>
                  </div>

                  {editVariants.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Sin variantes</div>
                  ) : (
                    <div className="space-y-3">
                      {editVariants.map((variant, index) => (
                        <div key={variant.id} className="rounded-xl bg-muted/20 p-3">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-black">Variante {index + 1}</span>
                            <button type="button" onClick={() => setEditVariants((current) => current.filter((item) => item.id !== variant.id))} className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-black text-destructive">Quitar</button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="text-xs font-bold">Nombre
                              <input value={variant.name} onChange={(e) => updateEditVariant(variant.id, { name: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" />
                            </label>
                            <label className="text-xs font-bold">Precio €
                              <input type="number" min="0" step="0.01" value={variant.price} onChange={(e) => updateEditVariant(variant.id, { price: e.target.value })} placeholder="General" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" />
                            </label>
                            <label className="text-xs font-bold">Stock
                              <input type="number" min="0" step="1" value={variant.stock} onChange={(e) => updateEditVariant(variant.id, { stock: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" />
                            </label>
                            <label className="text-xs font-bold">SKU
                              <input value={variant.sku} onChange={(e) => updateEditVariant(variant.id, { sku: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" />
                            </label>
                            <label className="text-xs font-bold sm:col-span-2 lg:col-span-4">Imagen propia
                              <select value={variant.image} onChange={(e) => updateEditVariant(variant.id, { image: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5">
                                <option value="">Usar imagen principal</option>
                                {editImages.map((image, imageIndex) => <option key={`${image}-${imageIndex}`} value={image}>Foto {imageIndex + 1}{imageIndex === 0 ? " · Principal" : ""}</option>)}
                              </select>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <label className="block text-sm font-bold">Etiquetas
                  <input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="regalo, verano, premium" className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                </label>

                <div className="rounded-2xl border border-border p-4">
                  <div className="mb-3">
                    <p className="font-black">Completa tu compra</p>
                    <p className="text-xs text-muted-foreground">Elige hasta 8 productos relacionados. Si no eliges ninguno, Herencia seguirá recomendando automáticamente.</p>
                  </div>

                  <input
                    value={relatedSearch}
                    onChange={(e) => setRelatedSearch(e.target.value)}
                    placeholder="Buscar producto relacionado…"
                    className="mb-3 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
                  />

                  {editRelatedIds.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {editRelatedIds.map((id) => {
                        const related = products.find((item) => String(item.id) === id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setEditRelatedIds((current) => current.filter((item) => item !== id))}
                            className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary"
                          >
                            {related?.name || id} ×
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                    {products
                      .filter((item) => String(item.id) !== String(editingProduct.id))
                      .filter((item) => {
                        const query = relatedSearch.trim().toLowerCase();
                        if (!query) return true;
                        return [item.name, item.sku, item.category]
                          .filter(Boolean)
                          .join(" ")
                          .toLowerCase()
                          .includes(query);
                      })
                      .slice(0, 20)
                      .map((item) => {
                        const id = String(item.id);
                        const checked = editRelatedIds.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() =>
                              setEditRelatedIds((current) => {
                                if (current.includes(id)) return current.filter((value) => value !== id);
                                if (current.length >= 8) {
                                  toast.error("Puedes elegir hasta 8 productos relacionados");
                                  return current;
                                }
                                return [...current, id];
                              })
                            }
                            className={`flex items-center gap-3 rounded-xl border p-3 text-left ${
                              checked ? "border-primary bg-primary/5" : "border-border bg-background"
                            }`}
                          >
                            <div className="h-10 w-10 overflow-hidden rounded-lg bg-muted">
                              {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black">{item.name}</p>
                              <p className="text-xs text-muted-foreground">€{Number(item.salePrice || item.price || 0).toFixed(2)}</p>
                            </div>
                            <input type="checkbox" readOnly checked={checked} />
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="text-sm font-bold">Título SEO
                    <input value={editForm.seoTitle} onChange={(e) => setEditForm({ ...editForm, seoTitle: e.target.value.slice(0, 70) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                  <label className="text-sm font-bold">Meta descripción
                    <textarea value={editForm.seoDescription} onChange={(e) => setEditForm({ ...editForm, seoDescription: e.target.value.slice(0, 170) })} rows={3} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 mt-7 flex justify-end gap-2 border-t border-border bg-card/95 pt-4 backdrop-blur">
              <button onClick={cancelEdit} className="rounded-xl border border-border px-5 py-3 font-bold">Cancelar</button>
              <button onClick={() => void saveEdit()} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-black text-primary-foreground disabled:opacity-60">{saving ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
