import { useMemo, useState } from "react";
import { ArrowLeft, PackagePlus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";
import {
  COMMERCE_COLLECTIONS,
  getCommerceCollection,
  isPlantLikeCollection,
  isServiceCollection,
  productTypeForCollection,
} from "../../lib/commerceCatalog";

const initialForm = {
  name: "",
  description: "",
  collection: "plantas",
  extraCollections: [] as string[],
  category: "plantas-interior",
  status: "active",
  price: "",
  salePrice: "",
  cost: "",
  onSale: false,
  sku: "",
  barcode: "",
  stock: "0",
  trackInventory: true,
  iva: "21",
  featured: false,
  allowDedication: true,
  tags: "",
  variantsText: "",
  seoTitle: "",
  seoDescription: "",

  scientificName: "",
  environment: "interior",
  light: "indirecta",
  size: "",
  difficulty: "Fácil",
  petSafe: false,
  toxicity: "",
  water: "",
  temperature: "",

  material: "",
  color: "",
  dimensions: "",
  weight: "",

  allergens: "",
  portions: "",
  flavor: "",
  requiresRefrigeration: false,
  madeToOrder: false,

  durationMinutes: "",
  serviceArea: "Barcelona",
  bookingRequired: true,
  leadTimeDays: "",
};

type FormState = typeof initialForm;

function parseVariants(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, price, stock, sku] = line.split("|").map((part) => part.trim());
      return {
        name,
        price: price ? Math.max(0, Number(price)) : undefined,
        stock: stock ? Math.max(0, Math.floor(Number(stock))) : 0,
        sku: sku || undefined,
      };
    })
    .filter((variant) => variant.name);
}

export function AdminAddProduct({ onBack }: { onBack: () => void }) {
  const [formData, setFormData] = useState<FormState>(initialForm);
  const [imagePreview, setImagePreview] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const collection = useMemo(
    () => getCommerceCollection(formData.collection),
    [formData.collection]
  );
  const plantLike = isPlantLikeCollection(formData.collection);
  const service = isServiceCollection(formData.collection);
  const food = formData.collection === "dulce";
  const fashion = formData.collection === "moda";
  const physicalGeneral = ["jardineria", "sustratos", "decoracion"].includes(formData.collection);

  const normalPrice = Number(formData.price || 0);
  const cost = Number(formData.cost || 0);
  const margin = normalPrice > 0 && cost > 0 ? normalPrice - cost : 0;
  const marginPercent = normalPrice > 0 && cost > 0 ? (margin / normalPrice) * 100 : 0;

  function patch(patchValue: Partial<FormState>) {
    setFormData((current) => ({ ...current, ...patchValue }));
  }

  function changeCollection(nextId: string) {
    const next = getCommerceCollection(nextId);
    patch({
      collection: next.id,
      category: next.categories[0]?.id || next.id,
      trackInventory: next.inventoryDefault,
      stock: next.inventoryDefault ? formData.stock : "0",
      extraCollections: formData.extraCollections.filter((id) => id !== next.id),
    });
  }

  function toggleExtraCollection(id: string) {
    if (id === formData.collection) return;
    patch({
      extraCollections: formData.extraCollections.includes(id)
        ? formData.extraCollections.filter((item) => item !== id)
        : [...formData.extraCollections, id],
    });
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] || null;
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecciona una imagen válida");
    if (file.size > 8 * 1024 * 1024) return toast.error("La imagen supera 8 MB");

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.name.trim()) return toast.error("Escribe el nombre del artículo");
    if (!normalPrice || normalPrice <= 0) return toast.error("Escribe un precio válido");
    if (formData.onSale) {
      const sale = Number(formData.salePrice || 0);
      if (!sale || sale <= 0 || sale >= normalPrice) {
        return toast.error("El precio de oferta debe ser menor que el precio normal");
      }
    }

    try {
      setSaving(true);

      let imageUrl = "";
      if (selectedFile) {
        const uploaded = await backendApi.uploadSiteMediaFile(selectedFile);
        imageUrl = String(uploaded.media?.url || "");
        if (!imageUrl) throw new Error("Cloudflare R2 no devolvió la URL de la imagen");
      }

      const collections = [formData.collection, ...formData.extraCollections].filter(
        (value, index, rows) => value && rows.indexOf(value) === index
      );

      await backendApi.createCommerceProduct({
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: productTypeForCollection(formData.collection),
        collection: formData.collection,
        collections,
        category: formData.category,
        status: formData.status,
        active: formData.status === "active",
        featured: formData.featured,

        price: normalPrice,
        salePrice: formData.onSale ? Number(formData.salePrice) : undefined,
        compareAtPrice: formData.onSale ? normalPrice : null,
        onSale: formData.onSale,
        cost: formData.cost ? Math.max(0, Number(formData.cost)) : null,
        taxRate: Math.max(0, Number(formData.iva || 21)),

        sku:
          formData.sku.trim() ||
          `HER-${formData.collection.slice(0, 4).toUpperCase()}-${String(Date.now()).slice(-6)}`,
        barcode: formData.barcode.trim(),
        stock: formData.trackInventory
          ? Math.max(0, Math.floor(Number(formData.stock || 0)))
          : 0,
        trackInventory: formData.trackInventory,

        image: imageUrl || undefined,
        images: imageUrl ? [imageUrl] : [],
        allowDedication: formData.allowDedication,

        scientificName: formData.scientificName.trim(),
        environment: plantLike ? formData.environment : "",
        light: plantLike ? formData.light : "",
        size: plantLike ? formData.size.trim() : "",
        difficulty: plantLike ? formData.difficulty : "",
        petSafe: plantLike ? formData.petSafe : false,
        toxicity: plantLike ? formData.toxicity.trim() : "",
        water: plantLike ? formData.water.trim() : "",
        temperature: plantLike ? formData.temperature.trim() : "",

        seoTitle: formData.seoTitle.trim() || formData.name.trim(),
        seoDescription: formData.seoDescription.trim() || formData.description.trim(),
        variants: parseVariants(formData.variantsText),

        metadata: {
          tags: formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          material: formData.material.trim(),
          color: formData.color.trim(),
          dimensions: formData.dimensions.trim(),
          weight: formData.weight.trim(),
          allergens: formData.allergens.trim(),
          portions: formData.portions.trim(),
          flavor: formData.flavor.trim(),
          requiresRefrigeration: formData.requiresRefrigeration,
          madeToOrder: formData.madeToOrder,
          durationMinutes: formData.durationMinutes
            ? Math.max(0, Number(formData.durationMinutes))
            : null,
          serviceArea: formData.serviceArea.trim(),
          bookingRequired: formData.bookingRequired,
          leadTimeDays: formData.leadTimeDays
            ? Math.max(0, Number(formData.leadTimeDays))
            : null,
        },
      });

      window.dispatchEvent(new Event("backend-storage"));
      toast.success(
        formData.status === "active"
          ? `✅ "${formData.name.trim()}" publicado en ${collection.name}`
          : `✅ "${formData.name.trim()}" guardado como borrador`
      );
      setFormData(initialForm);
      setImagePreview("");
      setSelectedFile(null);
      setTimeout(onBack, 250);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo crear el artículo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al catálogo
      </button>

      <div className="rounded-3xl border border-border bg-card p-5 sm:p-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
              Catálogo Herencia
            </p>
            <h2 className="mt-2 text-3xl font-black text-foreground">Crear artículo para vender</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Crea plantas, moda, dulce, servicios, decoración y cualquier artículo comercial desde un único formulario conectado a Neon.
            </p>
          </div>
          <div className="rounded-2xl bg-muted px-4 py-3 text-sm">
            <span className="font-bold">{collection.name}</span>
            <span className="block text-xs text-muted-foreground">{collection.description}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section>
            <h3 className="mb-3 text-lg font-black">1. ¿Qué vas a vender?</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {COMMERCE_COLLECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeCollection(item.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    formData.collection === item.id
                      ? "border-primary bg-primary/10 ring-2 ring-primary/15"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <p className="font-black">{item.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div>
              <h3 className="mb-3 text-lg font-black">2. Imagen principal</h3>
              {imagePreview ? (
                <div className="relative h-80 overflow-hidden rounded-2xl border border-border bg-muted">
                  <img src={imagePreview} alt="Vista previa" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setImagePreview("");
                    }}
                    className="absolute right-3 top-3 rounded-full bg-black/65 p-2 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="relative flex h-80 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 text-center hover:bg-muted/60">
                  <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                  <span className="font-bold">Subir imagen</span>
                  <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP, GIF o AVIF · máximo 8 MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    onChange={handleImageUpload}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              )}
            </div>

            <div className="space-y-5">
              <h3 className="text-lg font-black">3. Información principal</h3>

              <label className="block text-sm font-bold">
                Nombre *
                <input
                  value={formData.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  placeholder={
                    service
                      ? "Ej: Mantenimiento mensual de jardín"
                      : fashion
                        ? "Ej: Tote bag Herencia"
                        : food
                          ? "Ej: Tarta de tres leches"
                          : "Ej: Monstera deliciosa"
                  }
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>

              <label className="block text-sm font-bold">
                Descripción
                <textarea
                  value={formData.description}
                  onChange={(event) => patch({ description: event.target.value })}
                  rows={4}
                  placeholder="Explica qué es, qué incluye y por qué comprarlo."
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Colección principal *
                  <select
                    value={formData.collection}
                    onChange={(event) => changeCollection(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                  >
                    {COMMERCE_COLLECTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-bold">
                  Subcategoría *
                  <select
                    value={formData.category}
                    onChange={(event) => patch({ category: event.target.value })}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                  >
                    {collection.categories.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold">También mostrar en otras colecciones</p>
                <div className="flex flex-wrap gap-2">
                  {COMMERCE_COLLECTIONS.filter((item) => item.id !== formData.collection).map((item) => {
                    const checked = formData.extraCollections.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleExtraCollection(item.id)}
                        className={`rounded-full border px-3 py-2 text-xs font-bold ${
                          checked ? "border-primary bg-primary/10 text-primary" : "border-border"
                        }`}
                      >
                        {checked ? "✓ " : ""}{item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-muted/20 p-5">
            <h3 className="text-lg font-black">4. Precio, margen e inventario</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-bold">
                Precio normal (€) *
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(event) => patch({ price: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
              <label className="text-sm font-bold">
                Coste (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost}
                  onChange={(event) => patch({ cost: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
              <label className="text-sm font-bold">
                IVA (%)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.iva}
                  onChange={(event) => patch({ iva: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Margen estimado</p>
                <p className="mt-2 text-xl font-black">{margin > 0 ? `€${margin.toFixed(2)}` : "—"}</p>
                <p className="text-xs text-muted-foreground">{marginPercent > 0 ? `${marginPercent.toFixed(1)}%` : "Añade coste"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => patch({ onSale: !formData.onSale })}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                  formData.onSale ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                {formData.onSale ? "✓ En oferta" : "Activar oferta"}
              </button>
              <button
                type="button"
                onClick={() => patch({ featured: !formData.featured })}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                  formData.featured ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                {formData.featured ? "✓ Destacado" : "Marcar destacado"}
              </button>
            </div>

            {formData.onSale && (
              <label className="mt-4 block max-w-xs text-sm font-bold">
                Precio de oferta (€) *
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={(event) => patch({ salePrice: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-bold">
                SKU
                <input
                  value={formData.sku}
                  onChange={(event) => patch({ sku: event.target.value })}
                  placeholder="Automático si se deja vacío"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
              <label className="text-sm font-bold">
                Código de barras
                <input
                  value={formData.barcode}
                  onChange={(event) => patch({ barcode: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
              <label className="text-sm font-bold">
                Stock
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={!formData.trackInventory}
                  value={formData.stock}
                  onChange={(event) => patch({ stock: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 disabled:opacity-50"
                />
              </label>
              <label className="text-sm font-bold">
                Estado
                <select
                  value={formData.status}
                  onChange={(event) => patch({ status: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                >
                  <option value="active">Publicado</option>
                  <option value="draft">Borrador</option>
                </select>
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={formData.trackInventory}
                disabled={service}
                onChange={(event) => patch({ trackInventory: event.target.checked })}
              />
              {service
                ? "Los servicios no bloquean ventas por stock"
                : "Controlar inventario y bloquear venta al llegar a 0"}
            </label>
          </section>

          {plantLike && (
            <section className="rounded-2xl border border-border p-5">
              <h3 className="text-lg font-black">5. Datos de planta / cultivo</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm font-bold">Nombre científico
                  <input value={formData.scientificName} onChange={(e) => patch({ scientificName: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Ubicación
                  <select value={formData.environment} onChange={(e) => patch({ environment: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3">
                    <option value="interior">Interior</option>
                    <option value="exterior">Exterior</option>
                    <option value="interior exterior">Interior / exterior</option>
                  </select>
                </label>
                <label className="text-sm font-bold">Luz
                  <select value={formData.light} onChange={(e) => patch({ light: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3">
                    <option value="baja">Poca luz</option>
                    <option value="indirecta">Luz indirecta</option>
                    <option value="sol">Sol</option>
                  </select>
                </label>
                <label className="text-sm font-bold">Tamaño
                  <input value={formData.size} onChange={(e) => patch({ size: e.target.value })} placeholder="Ej: 40–60 cm" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Dificultad
                  <select value={formData.difficulty} onChange={(e) => patch({ difficulty: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3">
                    <option>Fácil</option><option>Media</option><option>Avanzada</option>
                  </select>
                </label>
                <label className="text-sm font-bold">Riego
                  <input value={formData.water} onChange={(e) => patch({ water: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Temperatura
                  <input value={formData.temperature} onChange={(e) => patch({ temperature: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Toxicidad
                  <input value={formData.toxicity} onChange={(e) => patch({ toxicity: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
              </div>
              <button
                type="button"
                onClick={() => patch({ petSafe: !formData.petSafe })}
                className={`mt-4 rounded-xl border px-4 py-2 text-sm font-bold ${
                  formData.petSafe ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                {formData.petSafe ? "✓ Apta para mascotas" : "Marcar apta para mascotas"}
              </button>
            </section>
          )}

          {(fashion || physicalGeneral) && (
            <section className="rounded-2xl border border-border p-5">
              <h3 className="text-lg font-black">5. Características del artículo</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm font-bold">Material
                  <input value={formData.material} onChange={(e) => patch({ material: e.target.value })} placeholder="Algodón, cerámica…" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Color
                  <input value={formData.color} onChange={(e) => patch({ color: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Dimensiones
                  <input value={formData.dimensions} onChange={(e) => patch({ dimensions: e.target.value })} placeholder="30 × 20 × 12 cm" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Peso
                  <input value={formData.weight} onChange={(e) => patch({ weight: e.target.value })} placeholder="500 g" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
              </div>
            </section>
          )}

          {food && (
            <section className="rounded-2xl border border-border p-5">
              <h3 className="text-lg font-black">5. Información de Dulce</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm font-bold">Sabor
                  <input value={formData.flavor} onChange={(e) => patch({ flavor: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Porciones
                  <input value={formData.portions} onChange={(e) => patch({ portions: e.target.value })} placeholder="Ej: 8–10" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold sm:col-span-2">Alérgenos
                  <input value={formData.allergens} onChange={(e) => patch({ allergens: e.target.value })} placeholder="Gluten, leche, frutos secos…" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => patch({ requiresRefrigeration: !formData.requiresRefrigeration })} className={`rounded-xl border px-4 py-2 text-sm font-bold ${formData.requiresRefrigeration ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>❄️ Requiere frío</button>
                <button type="button" onClick={() => patch({ madeToOrder: !formData.madeToOrder })} className={`rounded-xl border px-4 py-2 text-sm font-bold ${formData.madeToOrder ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>🧁 Bajo pedido</button>
              </div>
            </section>
          )}

          {service && (
            <section className="rounded-2xl border border-border p-5">
              <h3 className="text-lg font-black">5. Configuración del servicio</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-bold">Duración aproximada (min)
                  <input type="number" min="0" value={formData.durationMinutes} onChange={(e) => patch({ durationMinutes: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Zona del servicio
                  <input value={formData.serviceArea} onChange={(e) => patch({ serviceArea: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Antelación mínima (días)
                  <input type="number" min="0" value={formData.leadTimeDays} onChange={(e) => patch({ leadTimeDays: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
              </div>
              <button type="button" onClick={() => patch({ bookingRequired: !formData.bookingRequired })} className={`mt-4 rounded-xl border px-4 py-2 text-sm font-bold ${formData.bookingRequired ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                {formData.bookingRequired ? "✓ Requiere reserva/cita" : "No requiere reserva"}
              </button>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-muted/20 p-5">
            <h3 className="text-lg font-black">6. Variantes, etiquetas y personalización</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="block text-sm font-bold">
                Variantes
                <textarea
                  value={formData.variantsText}
                  onChange={(e) => patch({ variantsText: e.target.value })}
                  rows={5}
                  placeholder={"Una por línea: nombre | precio | stock | SKU\nTalla M · Verde | 24.90 | 5 | MOD-M-V"}
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3"
                />
                <span className="mt-1 block text-xs text-muted-foreground">Sirve para tallas, tamaños, sabores, packs o tipos de servicio.</span>
              </label>
              <div className="space-y-4">
                <label className="block text-sm font-bold">
                  Etiquetas
                  <input
                    value={formData.tags}
                    onChange={(e) => patch({ tags: e.target.value })}
                    placeholder="regalo, verano, premium, boda"
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => patch({ allowDedication: !formData.allowDedication })}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                    formData.allowDedication ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  {formData.allowDedication ? "✓ Permitir dedicatoria/personalización" : "Permitir dedicatoria/personalización"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h3 className="text-lg font-black">7. SEO</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="text-sm font-bold">
                Título SEO
                <input
                  value={formData.seoTitle}
                  onChange={(e) => patch({ seoTitle: e.target.value.slice(0, 70) })}
                  placeholder={formData.name || "Título para Google"}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
              <label className="text-sm font-bold">
                Meta descripción
                <textarea
                  value={formData.seoDescription}
                  onChange={(e) => patch({ seoDescription: e.target.value.slice(0, 170) })}
                  rows={3}
                  placeholder={formData.description || "Descripción para buscadores"}
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
            </div>
          </section>

          <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">{formData.name || "Nuevo artículo"}</p>
              <p className="text-xs text-muted-foreground">
                {collection.name} · {formData.status === "active" ? "Se publicará al guardar" : "Se guardará como borrador"}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onBack} className="rounded-xl border border-border px-5 py-3 font-bold">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-black text-primary-foreground disabled:opacity-60"
              >
                <PackagePlus className="h-5 w-5" />
                {saving ? "Guardando…" : formData.status === "active" ? "Guardar y publicar" : "Guardar borrador"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
