import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PackagePlus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";
import { buildPlantProfilePublishPatch } from "../../lib/plantProfile";
import {
  COMMERCE_COLLECTIONS,
  getCommerceCollection,
  isPlantCareProduct,
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
  humidity: "",
  fertilizer: "",
  plantTips: "",
  plantBenefits: "",

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

type VariantDraft = {
  id: string;
  name: string;
  price: string;
  stock: string;
  sku: string;
  imageIndex: number | null;
};

type SelectedImage = {
  id: string;
  file?: File;
  remoteUrl?: string;
  preview: string;
};

function makeVariant(): VariantDraft {
  return {
    id: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    price: "",
    stock: "0",
    sku: "",
    imageIndex: null,
  };
}

function readImagePreview(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

export function AdminAddProduct({ onBack }: { onBack: () => void }) {
  const [formData, setFormData] = useState<FormState>(initialForm);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [collectionOptions, setCollectionOptions] = useState<any[]>(
    COMMERCE_COLLECTIONS.map((item) => ({ id: item.id, name: item.name, status: "active" }))
  );
  const [saving, setSaving] = useState(false);
  const [generatingPlantInfo, setGeneratingPlantInfo] = useState(false);
  const [generatingVisual, setGeneratingVisual] = useState(false);
  const [visualError, setVisualError] = useState("");
  const [visualProgress, setVisualProgress] = useState("");
  const [visualBatchCount, setVisualBatchCount] = useState(5);
  const [visualReferences, setVisualReferences] = useState<SelectedImage[]>([]);
  const [visualMode, setVisualMode] = useState<"own" | "automatic" | "house" | "clear">("automatic");
  const visualOptions = [
    { id: "own", title: "Mis propias fotos", description: "Hasta 8 imágenes. Herencia no las modifica." },
    { id: "automatic", title: "Automático Herencia", description: "Usa Casa Herencia como identidad principal y conserva el mismo lenguaje visual." },
    { id: "house", title: "Casa Herencia", description: "Fondo oficial Herencia: crema cálido, madera, luz dorada y sombras de ventana." },
    { id: "clear", title: "Herencia Claro", description: "Versión limpia en marfil cálido manteniendo luz y materiales Herencia." },
  ] as const;

  const HERENCIA_HOUSE_MASTER_PROMPT = `
IDENTIDAD VISUAL MAESTRA — CASA HERENCIA.
Esta instrucción NO es inspiración opcional: es el aspecto obligatorio de la imagen.

La escena debe parecer fotografiada dentro de la misma Casa Herencia de todo el catálogo:
- pared crema / beige marfil muy cálida, mate y luminosa;
- luz natural dorada entrando lateralmente por una ventana real;
- sombras lineales de marco/persiana de ventana claramente visibles sobre pared, suelo y parcialmente sobre el producto;
- suelo o superficie cálida en madera clara, piedra crema o material natural;
- detalles secundarios muy discretos de madera, cerámica artesanal, fibras vegetales/ratán y alguna vegetación desenfocada;
- maceta principal neutra en crema, arena o piedra, preferiblemente cerámica mate o acanalada;
- ambiente doméstico premium, mediterráneo-orgánico, sereno y elegante;
- profundidad fotográfica real, no render 3D;
- temperatura de color cálida, sin blancos fríos, sin tonos azulados, sin luces LED;
- composición comercial limpia: la planta domina el encuadre y el fondo nunca compite con ella.

MUY IMPORTANTE:
Todas las imágenes deben sentirse como diferentes fotografías de LA MISMA CASA y LA MISMA SESIÓN DE MARCA.
No inventes un salón distinto, una arquitectura distinta o una paleta distinta en cada generación.
No uses fondos oscuros, grises fríos, blancos clínicos, colores fuertes, neón ni decoración recargada.
No uses fondos de estudio genéricos cuando el modo sea Casa Herencia.
No añadas texto, logos, marcas de agua ni personas.

FOTOGRAFÍA:
fotorealismo editorial de ecommerce premium; óptica equivalente 50–85 mm; luz lateral natural; sombras físicamente coherentes; texturas reales en hojas, madera, cerámica y pared; pequeñas imperfecciones naturales; nada plástico ni artificial.

BOTÁNICA:
la especie debe ser fiel y reconocible; hojas, nervaduras, tallos, variegación y porte correctos; nada duplicado, fusionado o imposible.
`.trim();

  const HERENCIA_CLEAR_MASTER_PROMPT = `
IDENTIDAD VISUAL — HERENCIA CLARO.
Fondo marfil/blanco crema cálido, jamás blanco clínico. Pared mate con textura mineral muy sutil, superficie crema o piedra clara, luz natural lateral dorada y sombras suaves reales. Mantener la misma temperatura, macetas neutras y fotorealismo editorial de Casa Herencia, pero con un escenario más limpio y minimalista. Sin texto, logos, personas, marcas de agua ni apariencia de render.
`.trim();

  useEffect(() => {
    let cancelled = false;
    backendApi.listCommerceCollections().then((result) => {
      if (cancelled) return;
      const rows = Array.isArray(result.collections)
        ? result.collections.filter((item: any) => String(item.status || "active") === "active")
        : [];
      if (rows.length) setCollectionOptions(rows);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const collection = useMemo(
    () => getCommerceCollection(formData.collection),
    [formData.collection]
  );
  const plantLike = isPlantCareProduct({ collection: formData.collection, category: formData.category });
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

  async function generatePlantInfoFromName() {
    const plantName = formData.name.trim();
    if (!plantLike || !plantName || formData.description.trim() || generatingPlantInfo) return;
    try {
      setGeneratingPlantInfo(true);
      const aiPatch: any = await buildPlantProfilePublishPatch({
        name: plantName,
        collection: formData.collection,
        category: formData.category,
      }, { force: true });
      patch({
        description: String(aiPatch.description || "").trim(),
        scientificName: String(aiPatch.scientificName || "").trim(),
        difficulty: String(aiPatch.difficulty || formData.difficulty || "Fácil").trim(),
        toxicity: String(aiPatch.toxicity || "").trim(),
        petSafe: typeof aiPatch.petSafe === "boolean" ? aiPatch.petSafe : formData.petSafe,
        water: String(aiPatch.water || "").trim(),
        light: String(aiPatch.light || formData.light || "").trim(),
        temperature: String(aiPatch.temperature || "").trim(),
        humidity: String(aiPatch.plantProfile?.humidity || "").trim(),
        fertilizer: String(aiPatch.plantProfile?.care?.fertilizer || "").trim(),
        plantTips: String(aiPatch.plantProfile?.tips || "").trim(),
        plantBenefits: Array.isArray(aiPatch.plantProfile?.benefits) ? aiPatch.plantProfile.benefits.join(" · ") : "",
        seoDescription: String(aiPatch.description || "").trim(),
      });
      toast.success("Ficha de cuidados generada con Groq");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo generar la ficha con Groq");
    } finally {
      setGeneratingPlantInfo(false);
    }
  }

  async function handleNameBlur() {
    await generatePlantInfoFromName();
  }

  async function handleVisualReferenceUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length) return;
    const remaining = Math.max(0, 5 - visualReferences.length);
    if (!remaining) return toast.error("Puedes usar un máximo de 5 referencias maestras");
    const accepted = files.slice(0, remaining);
    for (const file of accepted) {
      if (!file.type.startsWith("image/")) return toast.error(`${file.name}: formato no válido`);
      if (file.size > 6 * 1024 * 1024) return toast.error(`${file.name}: supera 6 MB`);
    }
    try {
      const references = await Promise.all(accepted.map(async (file) => ({
        id: `reference-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: await readImagePreview(file),
      })));
      setVisualReferences((current) => [...current, ...references].slice(0, 5));
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron preparar las referencias");
    }
  }

  function removeVisualReference(index: number) {
    setVisualReferences((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function masterReferences() {
    return visualReferences.map((reference) => ({ image: reference.preview })).filter((reference) => reference.image.startsWith("data:image/"));
  }

  async function generateHerenciaVisual() {
    if (visualMode === "own") return toast.info("Tus fotos propias se mantienen originales y no pasan por IA");
    if (!formData.name.trim()) return toast.error("Escribe primero el nombre de la planta");
    if (selectedImages.length >= 8) return toast.error("La galería ya tiene el máximo de 8 imágenes");
    const scenePrompt = visualMode === "clear" ? HERENCIA_CLEAR_MASTER_PROMPT : HERENCIA_HOUSE_MASTER_PROMPT;
    try {
      setVisualError("");
      setVisualProgress("Generando 1 imagen con Gemini…");
      setGeneratingVisual(true);
      const result = await backendApi.generateProductImage({
        prompt: `${scenePrompt}

PRODUCTO: ${formData.name.trim()}.
TOMA: principal de catálogo, cámara a la altura del producto, planta grande y protagonista ocupando aproximadamente 70–85% del área útil.
Mantén proporciones naturales y una maceta Herencia neutra. La imagen final debe poder colocarse junto a las fotografías existentes de Palma Areca, Calathea Orbifolia, Philodendron Brasil, Zamioculca y Begonia maculata sin que parezca otra marca u otra casa.`,
        references: masterReferences(),
      });
      if (!result.image) throw new Error("La IA no devolvió imagen");
      const uploaded = await backendApi.uploadSiteMedia({ dataUrl: result.image, filename: `herencia-${formData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.png` });
      const url = String(uploaded.media?.url || "");
      if (!url) throw new Error("No se pudo guardar la imagen generada en R2");
      setSelectedImages((current) => [...current, { id: `ai-${Date.now()}`, remoteUrl: url, preview: url }].slice(0, 8));
      setVisualProgress("Imagen generada y guardada.");
      toast.success("Imagen Herencia generada y añadida a la galería");
    } catch (error: any) {
      const message = error?.message || "No se pudo generar la imagen Herencia";
      setVisualError(message);
      setVisualProgress("");
      toast.error(message);
    } finally {
      setGeneratingVisual(false);
    }
  }

  async function generateHerenciaGallery() {
    if (visualMode === "own") return toast.info("Tus fotos propias no pasan por IA");
    if (!formData.name.trim()) return toast.error("Escribe primero el nombre de la planta");
    const count = Math.min(visualBatchCount, Math.max(0, 8 - selectedImages.length));
    if (!count) return toast.error("La galería ya tiene 8 imágenes");
    const shots = ["principal frontal","tres cuartos lateral","detalle de hojas","ambiental abierta","detalle de maceta","lateral alternativa","editorial vertical","detalle botánico"];
    try {
      setVisualError("");
      setVisualProgress(`Preparando galería de ${count} imágenes…`);
      setGeneratingVisual(true);
      for (let index = 0; index < count; index += 1) {
        setVisualProgress(`Generando imagen ${index + 1} de ${count}…`);
        const scenePrompt = visualMode === "clear" ? HERENCIA_CLEAR_MASTER_PROMPT : HERENCIA_HOUSE_MASTER_PROMPT;
        const result = await backendApi.generateProductImage({
          prompt: `${scenePrompt}

PRODUCTO: ${formData.name.trim()}.
TOMA: ${shots[index]}.
Conserva el MISMO producto, la MISMA maceta y la MISMA Casa Herencia entre todas las imágenes de esta galería. Cambia únicamente el encuadre, distancia o ángulo indicado. La planta debe seguir siendo protagonista y el fondo debe conservar pared crema cálida, madera/material natural, luz dorada lateral y sombras de ventana coherentes. Botánica fiel y proporciones naturales.`,
          references: masterReferences(),
        });
        if (!result.image) throw new Error("No se pudo generar una imagen");
        const uploaded = await backendApi.uploadSiteMedia({ dataUrl: result.image, filename: `herencia-${Date.now()}-${index + 1}.png` });
        const url = String(uploaded.media?.url || "");
        if (!url) throw new Error("No se pudo guardar una imagen");
        setSelectedImages((current) => [...current, { id: `ai-${Date.now()}-${index}`, remoteUrl: url, preview: url }].slice(0, 8));
      }
      setVisualProgress(`Galería terminada: ${count} imágenes.`);
      toast.success(`Galería Herencia generada: ${count} imágenes`);
    } catch (error: any) {
      const message = error?.message || "No se pudo completar la galería";
      setVisualError(message);
      setVisualProgress("");
      toast.error(message);
    } finally {
      setGeneratingVisual(false);
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length) return;

    const remaining = Math.max(0, 8 - selectedImages.length);
    if (!remaining) return toast.error("Puedes añadir un máximo de 8 imágenes");

    const accepted = files.slice(0, remaining);
    for (const file of accepted) {
      if (!file.type.startsWith("image/")) return toast.error(`${file.name}: formato no válido`);
      if (file.size > 8 * 1024 * 1024) return toast.error(`${file.name}: supera 8 MB`);
    }

    try {
      const previews = await Promise.all(
        accepted.map(async (file) => ({
          id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          preview: await readImagePreview(file),
        }))
      );
      setSelectedImages((current) => [...current, ...previews].slice(0, 8));
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron preparar las imágenes");
    }
  }

  function handleAddImageUrl() {
    const value = imageUrlInput.trim();
    if (!value) return toast.error("Pega la URL de una imagen");
    if (selectedImages.length >= 8) return toast.error("Puedes añadir un máximo de 8 imágenes");

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return toast.error("La URL de la imagen no es válida");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return toast.error("La URL debe empezar por http:// o https://");
    }

    if (selectedImages.some((image) => image.remoteUrl === parsed.toString())) {
      return toast.error("Esa imagen ya está añadida");
    }

    setSelectedImages((current) => [
      ...current,
      {
        id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        remoteUrl: parsed.toString(),
        preview: parsed.toString(),
      },
    ].slice(0, 8));
    setImageUrlInput("");
  }

  function moveImage(index: number, direction: -1 | 1) {
    setSelectedImages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setVariants((current) =>
      current.map((variant) => {
        if (variant.imageIndex === index) return { ...variant, imageIndex: index + direction };
        if (variant.imageIndex === index + direction) return { ...variant, imageIndex: index };
        return variant;
      })
    );
  }

  function removeImage(index: number) {
    setSelectedImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setVariants((current) =>
      current.map((variant) => ({
        ...variant,
        imageIndex:
          variant.imageIndex === index
            ? null
            : variant.imageIndex !== null && variant.imageIndex > index
              ? variant.imageIndex - 1
              : variant.imageIndex,
      }))
    );
  }

  function updateVariant(id: string, patchValue: Partial<VariantDraft>) {
    setVariants((current) =>
      current.map((variant) => (variant.id === id ? { ...variant, ...patchValue } : variant))
    );
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

      const imageUrls: string[] = [];
      for (const image of selectedImages) {
        if (image.remoteUrl) {
          imageUrls.push(image.remoteUrl);
          continue;
        }

        if (!image.file) continue;
        const uploaded = await backendApi.uploadSiteMediaFile(image.file);
        const url = String(uploaded.media?.url || "");
        if (!url) throw new Error(`Cloudflare R2 no devolvió URL para ${image.file.name}`);
        imageUrls.push(url);
      }
      const imageUrl = imageUrls[0] || "";

      const collections = [formData.collection, ...formData.extraCollections].filter(
        (value, index, rows) => value && rows.indexOf(value) === index
      );

      const productPayload: any = {
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
        images: imageUrls,
        allowDedication: formData.allowDedication,

        scientificName: plantLike ? formData.scientificName.trim() : "",
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
        variants: variants
          .filter((variant) => variant.name.trim())
          .map((variant) => ({
            name: variant.name.trim(),
            price: variant.price ? Math.max(0, Number(variant.price)) : undefined,
            stock: variant.stock ? Math.max(0, Math.floor(Number(variant.stock))) : 0,
            sku: variant.sku.trim() || undefined,
            image:
              variant.imageIndex !== null && imageUrls[variant.imageIndex]
                ? imageUrls[variant.imageIndex]
                : undefined,
          })),

        metadata: {
          visualStyle: plantLike ? visualMode : "own",
          preserveOriginalImages: visualMode === "own",
          maxImages: 8,
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
      };

      let finalPayload = productPayload;
      if (formData.status === "active") {
        try {
          const aiPatch = await buildPlantProfilePublishPatch(productPayload);
          finalPayload = {
            ...productPayload,
            ...aiPatch,
            metadata: {
              ...(productPayload.metadata || {}),
              ...(aiPatch as any).metadata,
            },
          };
        } catch (error: any) {
          throw new Error(
            error?.message
              ? `No se pudo publicar la planta: ${error.message}. Guárdala como borrador y vuelve a intentarlo.`
              : "No se pudo generar la ficha IA de la planta. Guárdala como borrador y vuelve a intentarlo."
          );
        }
      }

      await backendApi.createCommerceProduct(finalPayload);

      window.dispatchEvent(new Event("backend-storage"));
      toast.success(
        formData.status === "active"
          ? `✅ "${formData.name.trim()}" publicado en ${collection.name}`
          : `✅ "${formData.name.trim()}" guardado como borrador`
      );
      setFormData(initialForm);
      setSelectedImages([]);
      setImageUrlInput("");
      setVariants([]);
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

          {plantLike && (
            <section className="rounded-2xl border border-border bg-muted/20 p-5">
              <h3 className="text-lg font-black">2. Plantillas visuales Herencia</h3>
              <p className="mt-1 text-xs text-muted-foreground">Mejora la galería sin cambiar el formulario actual. Tus fotos propias nunca se retocan ni regeneran.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {visualOptions.map((option) => (
                  <button key={option.id} type="button" onClick={() => setVisualMode(option.id)}
                    className={`rounded-2xl border p-4 text-left transition ${visualMode === option.id ? "border-primary bg-primary/10 ring-2 ring-primary/15" : "border-border bg-background hover:bg-muted/50"}`}>
                    <p className="font-black">{option.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>
              {visualMode !== "own" && (
                <div className="mt-4 rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-foreground">Referencias maestras Casa Herencia</p>
                      <p className="mt-1 text-xs text-muted-foreground">Hasta 5 fotos. Gemini las usa solo para copiar luz, interiorismo, paleta, encuadre y maceta; la especie siempre será la del producto.</p>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-black">{visualReferences.length}/5</span>
                  </div>
                  {visualReferences.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {visualReferences.map((reference, index) => (
                        <div key={reference.id} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                          <img src={reference.preview} alt={`Referencia maestra ${index + 1}`} className="h-full w-full object-cover" />
                          <button type="button" onClick={() => removeVisualReference(index)} className="absolute right-1.5 top-1.5 rounded-full bg-black/65 p-1 text-white"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {visualReferences.length < 5 && (
                    <label className="relative mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-3 text-xs font-black text-foreground hover:bg-muted/40">
                      <Upload className="h-4 w-4" /> {visualReferences.length ? "Añadir otra referencia" : "Subir referencias maestras"}
                      <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={handleVisualReferenceUpload} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">Estas referencias no se añaden a la galería del producto ni modifican tus fotos propias.</p>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
                {visualMode === "own" ? "Fotos originales: máximo 8. Solo se guardan, ordenan y publican; no pasan por IA." : "Casa Herencia usa como estándar el fondo crema cálido, madera, luz dorada lateral y sombras de ventana del catálogo actual. Las referencias maestras sirven para reforzar todavía más esa continuidad."}
                {visualMode !== "own" && (
                  <>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void generateHerenciaVisual()} disabled={generatingVisual || !formData.name.trim() || selectedImages.length >= 8} className="rounded-xl bg-primary px-4 py-2.5 font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{generatingVisual ? "Generando…" : "Generar 1 imagen"}</button>
                      <select value={visualBatchCount} onChange={(event) => setVisualBatchCount(Number(event.target.value))} disabled={generatingVisual} className="rounded-xl border border-border bg-background px-3 py-2.5 font-bold disabled:opacity-50">
                        {[3, 5, 8].map((count) => <option key={count} value={count}>{count} fotos</option>)}
                      </select>
                      <button type="button" onClick={() => void generateHerenciaGallery()} disabled={generatingVisual || !formData.name.trim() || selectedImages.length >= 8} className="rounded-xl border border-primary px-4 py-2.5 font-black text-primary disabled:cursor-not-allowed disabled:opacity-40">Generar galería</button>
                    </div>
                    {!formData.name.trim() && (
                      <p className="mt-2 font-bold text-amber-700">Escribe primero el nombre del producto en “Información principal”.</p>
                    )}
                    {visualProgress && !visualError && (
                      <p className="mt-2 font-black text-primary">{visualProgress}</p>
                    )}
                    {visualError && (
                      <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 font-bold text-destructive">
                        Error al generar: {visualError}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">2. Galería de imágenes</h3>
                  <p className="text-xs text-muted-foreground">La primera foto será la principal · máximo 8.</p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">{selectedImages.length}/8</span>
              </div>

              {selectedImages.length > 0 ? (
                <div className="space-y-3">
                  <div className="relative h-72 overflow-hidden rounded-2xl border border-border bg-muted">
                    <img src={selectedImages[0].preview} alt="Imagen principal" className="h-full w-full object-cover" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white">Principal</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {selectedImages.map((image, index) => (
                      <div key={image.id} className="overflow-hidden rounded-2xl border border-border bg-background">
                        <div className="relative aspect-square bg-muted">
                          <img src={image.preview} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                          <button type="button" onClick={() => removeImage(index)} className="absolute right-2 top-2 rounded-full bg-black/65 p-1.5 text-white">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="text-[11px] font-black">{index === 0 ? "Principal" : `Foto ${index + 1}`}</span>
                          <div className="flex gap-1">
                            <button type="button" disabled={index === 0} onClick={() => moveImage(index, -1)} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30">←</button>
                            <button type="button" disabled={index === selectedImages.length - 1} onClick={() => moveImage(index, 1)} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30">→</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedImages.length < 8 && (
                    <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-4 text-sm font-bold hover:bg-muted/40">
                      <Upload className="h-4 w-4" /> Añadir más fotos
                      <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={handleImageUpload} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                  )}
                </div>
              ) : (
                <label className="relative flex h-80 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 text-center hover:bg-muted/60">
                  <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                  <span className="font-bold">Subir fotos</span>
                  <span className="mt-1 max-w-64 text-xs text-muted-foreground">Hasta 8 imágenes JPG, PNG, WEBP, GIF o AVIF · máximo 8 MB cada una</span>
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={handleImageUpload} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
              )}

              <div className="mt-3 rounded-2xl border border-border bg-background p-3">
                <p className="text-sm font-black">Añadir imagen por URL</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Puedes pegar una URL pública de imagen. Se guardará directamente junto con las fotos subidas.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(event) => setImageUrlInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddImageUrl();
                      }
                    }}
                    disabled={selectedImages.length >= 8}
                    placeholder="https://ejemplo.com/imagen.webp"
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    disabled={selectedImages.length >= 8}
                    className="rounded-xl border border-border px-4 py-2.5 text-sm font-black hover:bg-muted disabled:opacity-50"
                  >
                    + Añadir URL
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-lg font-black">3. Información principal</h3>

              <label className="block text-sm font-bold">
                Nombre *
                <input
                  value={formData.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  onBlur={() => void handleNameBlur()}
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

              {plantLike && generatingPlantInfo && <p className="text-xs font-semibold text-primary">Groq está preparando descripción y cuidados…</p>}

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
                  {collectionOptions
                    .filter((item) => String(item.id) !== formData.collection && String(item.status || "active") === "active")
                    .map((item) => {
                      const id = String(item.id);
                      const checked = formData.extraCollections.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleExtraCollection(id)}
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">5. 🌿 Cuidados de la planta</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Groq los completa automáticamente y puedes editar cualquier dato antes de publicar.</p>
                </div>
                <button type="button" onClick={() => void generatePlantInfoFromName()} disabled={generatingPlantInfo || !formData.name.trim()} className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-muted disabled:opacity-50">
                  {generatingPlantInfo ? "Generando…" : "Regenerar con Groq"}
                </button>
              </div>
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
                <label className="text-sm font-bold">Humedad
                  <input value={formData.humidity} onChange={(e) => patch({ humidity: e.target.value })} placeholder="Ej: media-alta, 60–70 %" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Fertilización
                  <input value={formData.fertilizer} onChange={(e) => patch({ fertilizer: e.target.value })} placeholder="Ej: cada 4 semanas en primavera y verano" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Toxicidad
                  <input value={formData.toxicity} onChange={(e) => patch({ toxicity: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">Consejos
                  <textarea value={formData.plantTips} onChange={(e) => patch({ plantTips: e.target.value })} rows={3} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="text-sm font-bold">Beneficios / características destacadas
                  <textarea value={formData.plantBenefits} onChange={(e) => patch({ plantBenefits: e.target.value })} rows={3} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-3" />
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
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">Variantes</p>
                    <p className="text-xs text-muted-foreground">Tallas, colores, tamaños, sabores, packs o modalidades.</p>
                  </div>
                  <button type="button" onClick={() => setVariants((current) => [...current, makeVariant()])} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground">
                    + Añadir variante
                  </button>
                </div>

                {variants.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Sin variantes. El artículo usará el precio y stock generales.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {variants.map((variant, index) => (
                      <div key={variant.id} className="rounded-2xl border border-border bg-background p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-xs font-black">Variante {index + 1}</span>
                          <button type="button" onClick={() => setVariants((current) => current.filter((item) => item.id !== variant.id))} className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-black text-destructive">
                            Quitar
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-bold">Nombre
                            <input value={variant.name} onChange={(e) => updateVariant(variant.id, { name: e.target.value })} placeholder="Ej: Talla M · Verde" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" />
                          </label>
                          <label className="text-xs font-bold">SKU
                            <input value={variant.sku} onChange={(e) => updateVariant(variant.id, { sku: e.target.value })} placeholder="MOD-M-V" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" />
                          </label>
                          <label className="text-xs font-bold">Precio propio (€)
                            <input type="number" min="0" step="0.01" value={variant.price} onChange={(e) => updateVariant(variant.id, { price: e.target.value })} placeholder="Vacío = precio general" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" />
                          </label>
                          <label className="text-xs font-bold">Stock
                            <input type="number" min="0" step="1" value={variant.stock} onChange={(e) => updateVariant(variant.id, { stock: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" />
                          </label>
                          <label className="text-xs font-bold sm:col-span-2">Imagen de esta variante
                            <select value={variant.imageIndex === null ? "" : String(variant.imageIndex)} onChange={(e) => updateVariant(variant.id, { imageIndex: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5">
                              <option value="">Usar imagen principal</option>
                              {selectedImages.map((image, imageIndex) => (
                                <option key={image.id} value={imageIndex}>Foto {imageIndex + 1}{imageIndex === 0 ? " · Principal" : ""}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
