import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Flower2,
  ImagePlus,
  Link2,
  Loader2,
  Download,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";
import { REAL_PLANT_CATALOG_DRAFTS } from "../../data/realPlantCatalogDrafts";

type TaxonomyOption = {
  department: string;
  area: string;
  family: string;
  category: string;
  keywords: string[];
  description: string;
};

type ProductDraft = {
  tempId: string;
  fileName: string;
  image: string;
  images?: string[];
  name: string;
  description: string;
  department: string;
  area: string;
  family: string;
  category: string;
  price: string;
  active: boolean;
  featured: boolean;
  aiStatus: "pending" | "classified" | "manual" | "error";
  confidence?: number;
};

type SourceCatalogProduct = {
  id: string;
  name: string;
  description?: string;
  productUrl: string;
  sourceCatalogUrl: string;
  sourceHost: string;
  image?: string;
  images?: string[];
  supplierCategory?: string;
  category?: string;
  collection?: string;
  type?: string;
  department?: string;
  area?: string;
  family?: string;
};

const taxonomy: TaxonomyOption[] = [
  {
    department: "Ramos de flores",
    area: "Clásicos",
    family: "Rosas",
    category: "flores",
    keywords: ["rosa", "rosas", "red rose", "ramo rosas", "roses"],
    description: "Ramo de rosas elegante y fresco, ideal para regalar en ocasiones especiales.",
  },
  {
    department: "Ramos de flores",
    area: "Clásicos",
    family: "Rosas con paniculata",
    category: "flores",
    keywords: ["paniculata", "gypsophila", "rosas paniculata", "baby breath"],
    description: "Ramo de rosas con paniculata, romántico, delicado y muy comercial.",
  },
  {
    department: "Ramos de flores",
    area: "Clásicos",
    family: "Lirios y flores mixtas",
    category: "flores",
    keywords: ["lirio", "lirios", "lily", "margarita", "margaritas", "clavel", "claveles", "gerbera", "mix flores"],
    description: "Ramo mixto con flores frescas de temporada, alegre y colorido.",
  },
  {
    department: "Ramos de flores",
    area: "Temporada",
    family: "Tulipanes y peonías",
    category: "flores",
    keywords: ["tulipan", "tulipanes", "tulip", "peonia", "peonias", "peony", "peonies"],
    description: "Ramo de temporada con estilo delicado, fresco y elegante.",
  },
  {
    department: "Ramos de flores",
    area: "Estilo",
    family: "Silvestres y campestres",
    category: "flores",
    keywords: ["silvestre", "campestre", "wildflower", "matricaria", "limonium", "statice", "solidago", "eucalipto"],
    description: "Ramo silvestre de aspecto natural, fresco y con encanto mediterráneo.",
  },
  {
    department: "Ramos de flores",
    area: "Eventos",
    family: "Ramos de novia",
    category: "flores",
    keywords: ["novia", "boda", "bridal", "wedding", "bouquet novia", "ramo novia"],
    description: "Ramo de novia elegante, diseñado para bodas y eventos especiales.",
  },
  {
    department: "Ramos de flores",
    area: "Premium",
    family: "Ramos premium",
    category: "flores",
    keywords: ["premium", "lujo", "luxury", "elegante", "exclusivo", "ramo grande"],
    description: "Ramo premium de gran presencia, ideal para regalos especiales y escaparate.",
  },
  {
    department: "Plantas",
    area: "Interior",
    family: "Ficus",
    category: "plantas-interior",
    keywords: ["ficus", "lyrata", "elastica", "tineke", "ginseng", "benjamina", "robusta"],
    description: "Planta de interior decorativa, elegante y perfecta para aportar verde al hogar.",
  },
  {
    department: "Plantas",
    area: "Interior",
    family: "Verdes decorativas",
    category: "plantas-interior",
    keywords: ["aspidistra", "aralia", "schefflera", "pachira", "zamioculca", "dracaena", "sansevieria", "yuca"],
    description: "Planta verde de interior resistente y decorativa, ideal para hogares, oficinas y espacios comerciales.",
  },
  {
    department: "Plantas",
    area: "Interior",
    family: "Colgantes",
    category: "plantas-interior",
    keywords: ["poto", "pothos", "colgante", "tradescantia", "ceropegia", "hoya", "rhipsalis", "senecio"],
    description: "Planta colgante de interior, perfecta para estanterías, macetas suspendidas y rincones luminosos.",
  },
  {
    department: "Plantas",
    area: "Interior",
    family: "Helechos",
    category: "plantas-interior",
    keywords: ["helecho", "fern", "boston", "asplenium", "nido", "adiantum", "phlebodium"],
    description: "Helecho ornamental de interior, fresco, frondoso y muy decorativo.",
  },
  {
    department: "Plantas",
    area: "Exóticas",
    family: "Aglaonemas",
    category: "plantas-exoticas",
    keywords: ["aglaonema", "fucsia", "pink", "red", "silver", "lipstick", "aurora"],
    description: "Aglaonema de hojas llamativas, muy decorativa y perfecta para dar color a interiores.",
  },
  {
    department: "Plantas",
    area: "Exóticas",
    family: "Alocasias",
    category: "plantas-exoticas",
    keywords: ["alocasia", "frydek", "jacklyn", "black velvet", "regal", "marquesa", "silver dragon", "dragon scale"],
    description: "Alocasia tropical de hojas espectaculares, ideal para amantes de plantas especiales.",
  },
  {
    department: "Plantas",
    area: "Exóticas",
    family: "Bromelias",
    category: "plantas-exoticas",
    keywords: ["bromelia", "guzmania", "vriesea", "neoregelia", "aechmea", "tillandsia"],
    description: "Bromelia tropical de colores vivos, perfecta para regalar o decorar interiores con alegría.",
  },
  {
    department: "Plantas",
    area: "Exóticas",
    family: "Philodendron y Monstera",
    category: "plantas-exoticas",
    keywords: ["philodendron", "filodendro", "monstera", "adansonii", "deliciosa", "thai", "variegada", "pink princess"],
    description: "Planta tropical de interior con hojas muy decorativas y presencia elegante.",
  },
  {
    department: "Plantas",
    area: "Orquídeas",
    family: "Orquídeas",
    category: "orquideas",
    keywords: ["orquidea", "orquídea", "phalaenopsis", "cymbidium", "dendrobium", "vanda", "cattleya", "oncidium"],
    description: "Orquídea elegante y decorativa, ideal para regalar o vestir espacios con floración premium.",
  },
  {
    department: "Plantas",
    area: "Cactus y suculentas",
    family: "Cactus pequeños",
    category: "cactus-suculentas",
    keywords: ["mammillaria", "rebutia", "gymnocalycium", "astrophytum", "parodia", "mini cactus", "cactus pequeño"],
    description: "Cactus pequeño individual, fácil de cuidar y perfecto para detalles o decoración.",
  },
  {
    department: "Plantas",
    area: "Cactus y suculentas",
    family: "Cactus grandes",
    category: "cactus-suculentas",
    keywords: ["cereus", "trichocereus", "ferocactus", "echinocactus", "grusonii", "cactus grande", "candelabro"],
    description: "Cactus grande individual, decorativo, resistente y de gran presencia para interior luminoso o terraza protegida.",
  },
  {
    department: "Plantas",
    area: "Cactus y suculentas",
    family: "Suculentas",
    category: "cactus-suculentas",
    keywords: ["suculenta", "echeveria", "sedum", "crassula", "haworthia", "aloe", "aeonium", "graptopetalum", "pachyphytum"],
    description: "Suculenta individual, bonita, resistente y fácil de mantener.",
  },
  {
    department: "Plantas",
    area: "Cactus y suculentas",
    family: "Euphorbias",
    category: "cactus-suculentas",
    keywords: ["euphorbia", "euforbia", "trigona", "lactea", "obesa", "milii", "tirucalli", "cristata"],
    description: "Euphorbia exótica individual, de forma escultural y gran valor decorativo.",
  },
  {
    department: "Plantas",
    area: "Exterior",
    family: "Con flor",
    category: "plantas-exterior",
    keywords: ["geranio", "gitanilla", "petunia", "surfinia", "dipladenia", "hibiscus", "hortensia", "azalea", "camel", "gardenia", "lavanda"],
    description: "Planta de exterior con flor, ideal para balcones, terrazas y jardines mediterráneos.",
  },
  {
    department: "Plantas",
    area: "Exterior",
    family: "Verdes de exterior",
    category: "plantas-exterior",
    keywords: ["boj", "evonimo", "photinia", "pittosporum", "fatsia", "formio", "cordyline", "bambu", "palmito"],
    description: "Planta verde de exterior, resistente y decorativa para terraza o jardín.",
  },
  {
    department: "Plantas",
    area: "Palmeras",
    family: "Palmeras",
    category: "plantas-interior",
    keywords: ["kentia", "areca", "chamaedorea", "cocotero", "palmera", "cyca", "phoenix", "washingtonia", "chamaerops"],
    description: "Palmera decorativa de estilo tropical, ideal para dar altura y frescura al espacio.",
  },
];

function getDefaultTaxonomy() {
  return taxonomy[8];
}

function cleanProductName(value: string) {
  return value
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeForSearch(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function guessFromFileName(fileName: string): TaxonomyOption {
  const normalized = normalizeForSearch(fileName);
  return (
    taxonomy.find((item) => item.keywords.some((keyword) => normalized.includes(normalizeForSearch(keyword)))) ||
    getDefaultTaxonomy()
  );
}

function normalizeAiTaxonomy(result: any, fallback: TaxonomyOption) {
  const family = String(result?.family || result?.subcategory || fallback.family);
  const matching = taxonomy.find((item) => item.family.toLowerCase() === family.toLowerCase());
  return matching || fallback;
}

async function classifyWithGemini(draft: ProductDraft): Promise<Partial<ProductDraft>> {
  const allowedFamilies = taxonomy
    .map((item) => `${item.department} > ${item.area} > ${item.family} (${item.category})`)
    .join("\n");

  const response = await fetch("/api/admin/ai/classify-product-image", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: draft.image, allowedFamilies }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "La IA no pudo clasificar la imagen");

  const json = data?.result || {};
  const fallback = guessFromFileName(draft.fileName);
  const selected = normalizeAiTaxonomy(json, fallback);

  return {
    name: json.name || cleanProductName(draft.fileName),
    description: json.description || selected.description,
    department: selected.department,
    area: selected.area,
    family: selected.family,
    category: selected.category,
    confidence: Number(json.confidence || 0.7),
    aiStatus: "classified",
  };
}

function createDraftFromImage(fileName: string, image: string): ProductDraft {
  const selected = guessFromFileName(fileName);

  return {
    tempId: crypto.randomUUID(),
    fileName,
    image,
    name: cleanProductName(fileName) || selected.family,
    description: selected.description,
    department: selected.department,
    area: selected.area,
    family: selected.family,
    category: selected.category,
    price: "",
    active: false,
    featured: false,
    aiStatus: "manual",
    confidence: 0.35,
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AdminBulkProductImport({
  onBack, onOpenProduct,
}: {
  onBack: () => void;
  onOpenProduct: (productId: string) => void;
}) {
  const [drafts, setDrafts] = useState<ProductDraft[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceManual, setSourceManual] = useState<{ url: string; host: string; reason: string } | null>(null);
  const [sourceManualName, setSourceManualName] = useState("");
  const [sourceManualCost, setSourceManualCost] = useState("");
  const [sourceManualImage, setSourceManualImage] = useState("");
  const [sourceManualSaving, setSourceManualSaving] = useState(false);
  const [savedSourceProduct, setSavedSourceProduct] = useState<{ id: string; name: string; status: string; outcome: string } | null>(null);
  const [sourceProducts, setSourceProducts] = useState<SourceCatalogProduct[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<string, boolean>>({});
  const [selectedSourceImages, setSelectedSourceImages] = useState<Record<string, boolean>>({});
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceImporting, setSourceImporting] = useState(false);
  const [sourceSavingMedia, setSourceSavingMedia] = useState(false);
  const [repairingImported, setRepairingImported] = useState(false);
  const [sourceProgress, setSourceProgress] = useState({ done: 0, total: 0 });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const selectedSourceProducts = useMemo(
    () => sourceProducts.filter((product) => selectedSourceIds[product.id]),
    [sourceProducts, selectedSourceIds]
  );

  const productImageUrls = (product: SourceCatalogProduct) =>
    Array.from(
      new Set(
        (product.images?.length ? product.images : product.image ? [product.image] : [])
          .map((url) => String(url || "").trim())
          .filter(Boolean)
      )
    );

  const sourceImageKey = (product: SourceCatalogProduct, url: string) =>
    String(product.id) + "::" + url;

  const selectedImagesForProduct = (product: SourceCatalogProduct) =>
    productImageUrls(product).filter((url) => selectedSourceImages[sourceImageKey(product, url)]);

  const selectedSourceImageCount = useMemo(
    () =>
      sourceProducts.reduce(
        (count, product) =>
          count + productImageUrls(product).filter((url) => selectedSourceImages[sourceImageKey(product, url)]).length,
        0
      ),
    [sourceProducts, selectedSourceImages]
  );

  const groupedDrafts = useMemo(() => {
    return drafts.reduce<Record<string, ProductDraft[]>>((groups, draft) => {
      const key = `${draft.department} > ${draft.area} > ${draft.family}`;
      groups[key] = groups[key] || [];
      groups[key].push(draft);
      return groups;
    }, {});
  }, [drafts]);

  const analyzeSourceCatalog = async () => {
    const url = sourceUrl.trim();
    if (!url) {
      toast.error("Pega primero la URL del catálogo del proveedor");
      return;
    }

    setSourceLoading(true);
    setSourceProducts([]);
    setSourceManual(null);
    setSavedSourceProduct(null);
    setSelectedSourceIds({});
    setSelectedSourceImages({});
    setSourceProgress({ done: 0, total: 0 });

    try {
      const result = await backendApi.previewCatalogUrl(url, 100);
      const products = Array.isArray(result.products) ? result.products : [];
      setSourceProducts(products);
      setSelectedSourceIds({});
      setSelectedSourceImages({});
      if (result.requiresManual || !products.length) {
        setSourceManual({
          url: result.sourceUrl || url,
          host: result.sourceHost || new URL(url).hostname,
          reason: result.message || "El proveedor no permitió acceder a las fotografías o los datos del producto.",
        });
        toast.warning("Importación automática incompleta. Puedes crear un borrador privado con los datos reales.");
      } else {
        toast.success(products.length + " productos detectados en " + result.sourceHost);
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo analizar el catálogo del proveedor");
    } finally {
      setSourceLoading(false);
    }
  };

  const saveSourceManualDraft = async () => {
    if (!sourceManual) return;
    const name = sourceManualName.trim();
    if (!name) return toast.error("Escribe el nombre real del producto");
    if (/^(human verification|human machine check|verify you are human|just a moment|access denied|security verification|captcha)(?:\\b|[\\s.:|—-])/i.test(name)) {
      return toast.error("La pantalla de verificación no es un producto");
    }
    if (sourceManualCost.trim() && (!Number.isFinite(Number(sourceManualCost)) || Number(sourceManualCost) < 0)) {
      return toast.error("Revisa el coste del proveedor");
    }
    const rawImage = sourceManualImage.trim();
    if (rawImage) {
      try {
        const url = new URL(rawImage);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
      } catch { return toast.error("Pega una URL pública válida de imagen"); }
    }
    setSourceManualSaving(true);
    setSavedSourceProduct(null);
    try {
      const result = await backendApi.importCatalogUrlProduct({
        name,
        productUrl: sourceManual.url,
        sourceCatalogUrl: sourceManual.url,
        sourceHost: sourceManual.host,
        supplierPrice: Number(sourceManualCost || 0),
        supplierCurrency: "EUR",
        description: "",
        image: rawImage,
        images: rawImage ? [rawImage] : [],
        manualImport: true,
      });
      if (!result.ok || !result.product?.id) throw new Error("El servidor no confirmó el producto guardado");
      const lookup = await backendApi.getCommerceProduct(result.product.id);
      if (!lookup.product || String(lookup.product.id) !== String(result.product.id)) {
        throw new Error("No se encuentra el artículo en el catálogo después de guardarlo");
      }
      const found = lookup.product;
      const archived = found.status === "archived" || Boolean(found.deletedAt);
      setSavedSourceProduct({
        id: String(found.id),
        name: String(found.name || name),
        status: String(found.status || "draft"),
        outcome: archived ? "archived" : result.skipped ? "existing" : result.updated ? "updated" : "created",
      });
      toast.info(archived ? "Ya existe en la Papelera; no se creó otro." :
        result.skipped ? "El producto ya existía. Puedes abrirlo desde aquí." : "Borrador guardado en Productos → Ver productos");
      if (result.imageImportWarning) toast.warning(result.imageImportWarning);
      if (!result.skipped && !archived) setSourceManual(null);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo confirmar que el producto se guardó");
    } finally {
      setSourceManualSaving(false);
    }
  };

  const repairImportedDrafts = async () => {
    const host = (() => {
      try {
        return sourceUrl.trim() ? new URL(sourceUrl.trim()).hostname : "";
      } catch {
        return "";
      }
    })();

    const scope = host ? "los borradores importados desde " + host : "todos los borradores importados por URL";
    if (!window.confirm("Se repararán " + scope + ". Se conservarán precio, stock y datos comerciales, pero se actualizarán galería y clasificación desde la ficha original. ¿Continuar?")) {
      return;
    }

    setRepairingImported(true);
    try {
      const result = await backendApi.repairImportedCatalogDrafts(host, 50);
      if (!result.candidates) {
        toast.info("No hay borradores importados pendientes de reparar");
      } else if (result.errors) {
        toast.warning("Reparación terminada: " + result.repaired + " corregidos y " + result.errors + " con error");
      } else {
        toast.success("✅ " + result.repaired + " borradores importados reparados");
      }
      window.dispatchEvent(new Event("commerce-products-changed"));
      window.dispatchEvent(new Event("media-library-changed"));
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron reparar los borradores importados");
    } finally {
      setRepairingImported(false);
    }
  };

  const saveSelectedSourceMedia = async () => {
    const selected = sourceProducts
      .map((product) => ({ product, images: selectedImagesForProduct(product) }))
      .filter((item) => item.images.length > 0);

    if (!selected.length) {
      toast.error("Selecciona primero una o varias fotos");
      return;
    }

    setSourceSavingMedia(true);
    setSourceProgress({ done: 0, total: selected.length });
    let copied = 0;
    let errors = 0;
    const completedKeys: string[] = [];

    for (let index = 0; index < selected.length; index += 1) {
      const { product, images } = selected[index];
      try {
        const result = await backendApi.saveCatalogUrlProductMedia({
          ...product,
          image: images[0] || "",
          images,
        });
        copied += Number(result.copiedImages || 0);
        images.forEach((url) => completedKeys.push(sourceImageKey(product, url)));
      } catch {
        errors += 1;
      } finally {
        setSourceProgress({ done: index + 1, total: selected.length });
      }
    }

    if (completedKeys.length) {
      setSelectedSourceImages((current) => {
        const next = { ...current };
        completedKeys.forEach((key) => delete next[key]);
        return next;
      });
    }

    setSourceSavingMedia(false);
    window.dispatchEvent(new Event("media-library-changed"));

    if (errors) {
      toast.warning("Biblioteca actualizada: " + copied + " fotos guardadas y " + errors + " grupos con error");
    } else {
      toast.success("✅ " + copied + " fotos guardadas en la Biblioteca multimedia");
    }
  };

  const importSelectedSourceProducts = async () => {
    const selected = selectedSourceProducts;
    if (!selected.length) {
      toast.error("Selecciona al menos un producto");
      return;
    }

    setSourceImporting(true);
    setSourceProgress({ done: 0, total: selected.length });
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const completedIds: string[] = [];
    let lastSaved: { id: string; name: string; status: string; outcome: string } | null = null;
    setSavedSourceProduct(null);

    for (let index = 0; index < selected.length; index += 1) {
      const product = selected[index];
      try {
        const chosenImages = selectedImagesForProduct(product);
        const mainImage = product.image || productImageUrls(product)[0] || "";
        const importImages = chosenImages.length ? chosenImages : mainImage ? [mainImage] : [];
        const result = await backendApi.importCatalogUrlProduct({
          ...product,
          image: importImages[0] || "",
          images: importImages,
        });
        if (!result.product?.id) throw new Error("El proveedor no devolvió un ID de producto");
        if (result.skipped) skipped += 1;
        else if (result.updated) updated += 1;
        else imported += 1;
        lastSaved = {
          id: String(result.product.id),
          name: String(result.product.name || product.name),
          status: String(result.product.status || "draft"),
          outcome: result.reason === "archived_duplicate" ? "archived" :
            result.skipped ? "existing" : result.updated ? "updated" : "created",
        };
        completedIds.push(product.id);
      } catch {
        errors += 1;
      } finally {
        setSourceProgress({ done: index + 1, total: selected.length });
      }
    }

    if (completedIds.length) {
      setSelectedSourceIds((current) => {
        const next = { ...current };
        completedIds.forEach((id) => {
          next[id] = false;
        });
        return next;
      });
    }

    setSourceImporting(false);
    if (lastSaved) {
      try {
        const lookup = await backendApi.getCommerceProduct(lastSaved.id);
        if (lookup.product && String(lookup.product.id) === lastSaved.id) {
          setSavedSourceProduct(lastSaved);
        } else toast.warning("No se pudo localizar el último producto en el catálogo");
      } catch { toast.warning("Se importaron productos, pero no pudimos comprobar el último registro"); }
    }
    if (errors) {
      toast.warning("Importación terminada: " + imported + " nuevos, " + updated + " reparados, " + skipped + " ya existentes y " + errors + " con error");
    } else {
      toast.success("Importación terminada: " + imported + " nuevos, " + updated + " reparados y " + skipped + " ya existentes");
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      toast.error("Sube imágenes JPG, PNG o WEBP");
      return;
    }

    const newDrafts = await Promise.all(
      imageFiles.map(async (file) => createDraftFromImage(file.name, await readFileAsDataUrl(file)))
    );

    setDrafts((current) => [...current, ...newDrafts]);
    toast.success(`${newDrafts.length} imágenes preparadas para clasificar`);
  };

  const updateDraft = (tempId: string, patch: Partial<ProductDraft>) => {
    setDrafts((current) => current.map((draft) => (draft.tempId === tempId ? { ...draft, ...patch } : draft)));
  };

  const updateTaxonomy = (tempId: string, family: string) => {
    const selected = taxonomy.find((item) => item.family === family) || getDefaultTaxonomy();
    updateDraft(tempId, {
      department: selected.department,
      area: selected.area,
      family: selected.family,
      category: selected.category,
      description: selected.description,
      aiStatus: "manual",
    });
  };

  const loadRealPlantCatalog = () => {
    const existingNames = new Set(drafts.map((draft) => draft.name.trim().toLowerCase()));
    const additions = REAL_PLANT_CATALOG_DRAFTS
      .filter((plant) => !existingNames.has(plant.name.toLowerCase()))
      .map((plant) => ({
        tempId: crypto.randomUUID(),
        fileName: `${plant.slug}.jpg`,
        image: plant.image,
        images: plant.images?.length ? plant.images : [plant.image],
        name: plant.name,
        description: plant.description,
        department: "Plantas",
        area: plant.area,
        family: plant.family,
        category: plant.category,
        price: "",
        active: false,
        featured: false,
        aiStatus: "manual" as const,
        confidence: 1,
      }));

    setDrafts((current) => [...current, ...additions]);
    toast.success(`${additions.length} plantas reales añadidas como borradores`);
  };

  const saveRealCatalogToLibrary = async () => {
    setSavingLibrary(true);
    try {
      const current = await backendApi.listCommerceProducts({ includeArchived: true });
      const existing = Array.isArray(current.products) ? current.products : [];
      const existingSlugs = new Set(existing.map((product: any) => String(product?.metadata?.librarySlug || "")));
      const existingNames = new Set(existing.map((product: any) => String(product?.name || "").trim().toLowerCase()));
      const pending = REAL_PLANT_CATALOG_DRAFTS.filter(
        (plant) => !existingSlugs.has(plant.slug) && !existingNames.has(plant.name.trim().toLowerCase())
      );

      for (const plant of pending) {
        await backendApi.createCommerceProduct({
          name: plant.name,
          scientificName: plant.scientificName,
          description: plant.description,
          category: plant.category,
          collection: "plantas",
          collections: ["plantas"],
          type: "plant",
          department: "Plantas",
          area: plant.area,
          family: plant.family,
          subcategory: plant.family,
          image: plant.image,
          images: plant.images?.length ? plant.images : [plant.image],
          price: 0,
          stock: 0,
          trackInventory: true,
          active: false,
          status: "draft",
          featured: false,
          environment: plant.environment,
          light: plant.light,
          difficulty: plant.difficulty,
          toxicity: plant.toxicity,
          water: plant.watering,
          metadata: {
            libraryItem: true,
            librarySlug: plant.slug,
            imageSourcePage: plant.imageSourcePage,
            imageAuthor: plant.imageAuthor,
            imageLicense: plant.imageLicense,
            imageLicenseUrl: plant.imageLicenseUrl,
          },
        });
      }

      toast.success(
        pending.length
          ? `Biblioteca creada: ${pending.length} plantas guardadas como borradores en Neon`
          : "La biblioteca ya estaba sincronizada"
      );
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar la biblioteca en Neon");
    } finally {
      setSavingLibrary(false);
    }
  };

  const classifyAll = async () => {
    if (!drafts.length) return;

    setIsClassifying(true);
    let errors = 0;

    for (const draft of drafts) {
      try {
        updateDraft(draft.tempId, { aiStatus: "pending" });
        const result = await classifyWithGemini(draft);
        updateDraft(draft.tempId, result);
      } catch {
        errors += 1;
        const selected = guessFromFileName(draft.fileName);
        updateDraft(draft.tempId, {
          department: selected.department,
          area: selected.area,
          family: selected.family,
          category: selected.category,
          description: draft.description || selected.description,
          aiStatus: "error",
        });
      }
    }

    setIsClassifying(false);
    if (errors) {
      toast.warning(`Clasificación terminada con ${errors} imágenes usando modo aproximado`);
    } else {
      toast.success("Clasificación IA completada");
    }
  };

  const removeDraft = (tempId: string) => {
    setDrafts((current) => current.filter((draft) => draft.tempId !== tempId));
  };

  const importProducts = async () => {
    if (!drafts.length) {
      toast.error("No hay productos para importar");
      return;
    }
    // The visible catalog is stored in Neon commerce_products, not in the
    // legacy adminProducts storage key. Persist each product to the same
    // backend read by Productos → Ver productos.
    setSourceImporting(true);
    const failed: ProductDraft[] = [];
    let saved = 0;
    let lastId = "";
    for (const draft of drafts) {
      try {
        const response = await backendApi.createCommerceProduct({
          name: draft.name.trim() || draft.family,
          description: draft.description.trim() || "Artículo importado para revisar antes de publicar.",
          price: Number(draft.price || 0),
          collection: draft.category.startsWith("plantas") ? "plantas" : draft.category === "flores" ? "plantas" : "jardineria",
          category: draft.category,
          department: draft.department,
          area: draft.area,
          family: draft.family,
          subcategory: draft.family,
          image: draft.image,
          images: draft.images?.length ? draft.images : [draft.image],
          featured: draft.featured,
          onSale: false,
          active: draft.active,
          status: draft.active ? "active" : "draft",
          stock: 0,
        });
        if (!response.product?.id) throw new Error("No se confirmó el guardado");
        saved += 1;
        lastId = String(response.product.id);
      } catch {
        failed.push(draft);
      }
    }
    setSourceImporting(false);
    setDrafts(failed);
    if (failed.length) {
      toast.warning(`${saved} guardados en Productos y ${failed.length} sin guardar. Los fallidos siguen aquí para reintentar.`);
    } else {
      toast.success(`${saved} artículos guardados en Productos → Ver productos`);
      if (saved === 1 && lastId) onOpenProduct(lastId);
      else onBack();
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        Volver a productos
      </button>

      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Importación masiva IA
            </div>
            <h2 className="text-2xl font-bold text-foreground">Subir fotos y clasificarlas por familias</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Sirve para plantas y también para ramos. Las plantas se separan automáticamente en Interior, Exterior, Cactus y suculentas, Orquídeas o Exóticas. Se importan ocultas por defecto para que puedas revisar foto, precio y stock antes de publicarlas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveRealCatalogToLibrary}
              disabled={savingLibrary || isClassifying}
              className="inline-flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {savingLibrary ? "Guardando biblioteca..." : "Guardar catálogo en biblioteca"}
            </button>
            <button
              type="button"
              onClick={loadRealPlantCatalog}
              disabled={isClassifying}
              className="inline-flex items-center gap-2 px-4 py-3 border border-primary text-primary rounded-xl hover:bg-primary/5 disabled:opacity-50"
            >
              <ImagePlus className="w-4 h-4" />
              Cargar catálogo real · tanda 1
            </button>
            <button
              type="button"
              onClick={classifyAll}
              disabled={!drafts.length || isClassifying}
              className="inline-flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isClassifying ? "Clasificando..." : "Clasificar con IA"}
            </button>
            <button
              type="button"
              onClick={importProducts}
              disabled={!drafts.length || isClassifying}
              className="inline-flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Importar productos
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground">Importar desde URL del proveedor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pega una página de catálogo. Herencia detecta los productos, te deja elegir cuáles traer y copia sus imágenes a Cloudflare R2.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={sourceUrl}
              onChange={(event) => { setSourceUrl(event.target.value); setSourceManual(null); setSavedSourceProduct(null); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !sourceLoading && !sourceImporting && !sourceSavingMedia && !repairingImported) {
                  event.preventDefault();
                  void analyzeSourceCatalog();
                }
              }}
              placeholder="https://proveedor.com/categoria/productos/"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={sourceLoading || sourceImporting || sourceSavingMedia || repairingImported}
            />
            <button
              type="button"
              onClick={analyzeSourceCatalog}
              disabled={sourceLoading || sourceImporting || sourceSavingMedia || repairingImported || !sourceUrl.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {sourceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {sourceLoading ? "Analizando..." : "Analizar página"}
            </button>
            <button
              type="button"
              onClick={repairImportedDrafts}
              disabled={sourceLoading || sourceImporting || sourceSavingMedia || repairingImported}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              title={sourceUrl.trim() ? "Repara borradores del proveedor indicado" : "Repara todos los borradores importados por URL"}
            >
              {repairingImported ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {repairingImported ? "Reparando..." : "Reparar borradores importados"}
            </button>
          </div>

          {savedSourceProduct && (
            <div role="status" className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-bold">{savedSourceProduct.outcome === "archived" ? "Ya existe en la Papelera" :
                savedSourceProduct.outcome === "existing" ? "Ya estaba importado" :
                savedSourceProduct.outcome === "updated" ? "Borrador actualizado" : "Producto guardado en el catálogo"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{savedSourceProduct.name} · ID: {savedSourceProduct.id} · {savedSourceProduct.status}</p>
              <button type="button" onClick={() => onOpenProduct(savedSourceProduct.id)}
                className="mt-3 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
                {savedSourceProduct.outcome === "archived" ? "Abrir en Papelera" : "Ver y editar este producto"}
              </button>
            </div>
          )}
          {sourceManual && (
            <div className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <p className="font-bold">El proveedor no permite importar automáticamente esta ficha</p>
              <p className="text-sm">{sourceManual.reason}</p>
              <p className="text-sm">Puedes crear un borrador privado. Aún NO es una integración de pedidos con AliExpress.</p>
              <a className="inline-block text-sm font-semibold underline" href={sourceManual.url} target="_blank" rel="noopener noreferrer">Abrir producto en la web del proveedor</a>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={sourceManualName} onChange={(event) => setSourceManualName(event.target.value)}
                  placeholder="Nombre REAL del producto" aria-label="Nombre del producto"
                  className="rounded-lg border border-amber-200 bg-white px-3 py-2.5" />
                <input type="number" min="0" step="0.01" value={sourceManualCost} onChange={(event) => setSourceManualCost(event.target.value)}
                  placeholder="Coste proveedor en EUR (opcional)" aria-label="Coste proveedor"
                  className="rounded-lg border border-amber-200 bg-white px-3 py-2.5" />
                <input type="url" value={sourceManualImage} onChange={(event) => setSourceManualImage(event.target.value)}
                  placeholder="URL directa de la foto (opcional)" aria-label="URL de fotografía"
                  className="md:col-span-2 rounded-lg border border-amber-200 bg-white px-3 py-2.5" />
              </div>
              <button type="button" onClick={() => void saveSourceManualDraft()}
                disabled={sourceManualSaving || !sourceManualName.trim()}
                className="rounded-lg bg-amber-900 px-4 py-2.5 font-bold text-white disabled:opacity-50">
                {sourceManualSaving ? "Guardando…" : "Guardar borrador en Productos"}
              </button>
              <p className="text-xs">Si no añades una imagen, quedará pendiente de fotografía. No se publicará ni realizará compras automáticas.</p>
            </div>
          )}
          {sourceProducts.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
              <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{sourceProducts.length} productos encontrados</p>
                  <p className="text-xs text-muted-foreground">{selectedSourceProducts.length} productos para borrador · {selectedSourceImageCount} fotos para Biblioteca</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Nada se selecciona automáticamente. Producto y foto se eligen por separado.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSourceIds(
                        sourceProducts.reduce<Record<string, boolean>>((selected, product) => {
                          selected[product.id] = true;
                          return selected;
                        }, {})
                      )
                    }
                    disabled={sourceImporting || sourceSavingMedia}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    Seleccionar productos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSourceIds({})}
                    disabled={sourceImporting || sourceSavingMedia}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    Quitar productos
                  </button>
                  <button
                    type="button"
                    onClick={saveSelectedSourceMedia}
                    disabled={sourceImporting || sourceSavingMedia || !selectedSourceImageCount}
                    className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {sourceSavingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {sourceSavingMedia
                      ? "Guardando fotos " + sourceProgress.done + "/" + sourceProgress.total
                      : "Solo guardar " + selectedSourceImageCount + " foto" + (selectedSourceImageCount === 1 ? "" : "s") + " (NO crea producto)"}
                  </button>
                  <button
                    type="button"
                    onClick={importSelectedSourceProducts}
                    disabled={sourceImporting || sourceSavingMedia || !selectedSourceProducts.length}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {sourceImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {sourceImporting
                      ? "Importando " + sourceProgress.done + "/" + sourceProgress.total
                      : "Importar " + selectedSourceProducts.length + " seleccionados"}
                  </button>
                </div>
              </div>

              <div className="max-h-[520px] divide-y divide-border overflow-y-auto">
                {sourceProducts.map((product) => (
                  <div key={product.id} className="grid grid-cols-[auto_72px_1fr] gap-3 p-3 hover:bg-muted/30 sm:grid-cols-[auto_84px_1fr_auto] sm:items-start">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedSourceIds[product.id])}
                      onChange={(event) =>
                        setSelectedSourceIds((current) => ({ ...current, [product.id]: event.target.checked }))
                      }
                      disabled={sourceImporting || sourceSavingMedia}
                      className="mt-2 h-4 w-4 sm:mt-0"
                    />
                    <div className="h-16 w-[72px] overflow-hidden rounded-xl border border-border bg-muted sm:h-20 sm:w-[84px]">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">Sin foto</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{product.name}</p>
                      {product.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                          {product.department || product.category || "Catálogo"}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                          {productImageUrls(product).length} fotos
                        </span>
                      </div>
                      {productImageUrls(product).length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-[10px] font-bold text-muted-foreground">Marca solo las fotos que quieras guardar o usar:</p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {productImageUrls(product).map((url, index) => {
                              const key = sourceImageKey(product, url);
                              const checked = Boolean(selectedSourceImages[key]);
                              return (
                                <label key={key} className={"relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 bg-muted " + (checked ? "border-primary" : "border-border")}>
                                  <img src={url} alt={product.name + " " + (index + 1)} className="h-full w-full object-contain" />
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={sourceImporting || sourceSavingMedia}
                                    onChange={(event) =>
                                      setSelectedSourceImages((current) => ({ ...current, [key]: event.target.checked }))
                                    }
                                    className="absolute left-1 top-1 h-4 w-4"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="col-start-3 text-right text-[10px] text-muted-foreground sm:col-start-auto">
                      {product.sourceHost}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Usa esta opción únicamente con catálogos cuyas imágenes y datos tengas permiso para reutilizar.
          </p>
        </div>

        <label className="flex flex-col items-center justify-center min-h-64 border-2 border-dashed border-border rounded-3xl cursor-pointer hover:bg-accent/40 transition-colors text-center px-6">
          <UploadCloud className="w-12 h-12 text-primary mb-4" />
          <p className="font-semibold text-foreground">Suelta aquí una carpeta o muchas fotos</p>
          <p className="text-sm text-muted-foreground mt-1">Una foto = un producto: planta, cactus, suculenta, orquídea o ramo.</p>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            multiple
            onChange={(event) => handleFiles(event.target.files)}
          />
        </label>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground">Revisión por grupos ({drafts.length})</h3>
            <button onClick={() => setDrafts([])} className="text-sm text-destructive hover:underline">
              Vaciar todo
            </button>
          </div>

          {Object.entries(groupedDrafts).map(([group, groupDrafts]) => {
            const isOpen = openGroups[group] ?? true;

            return (
              <div key={group} className="bg-card border border-border rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenGroups((current) => ({ ...current, [group]: !isOpen }))}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-muted/50 hover:bg-muted"
                >
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{group}</p>
                    <p className="text-xs text-muted-foreground">{groupDrafts.length} productos</p>
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="divide-y divide-border">
                    {groupDrafts.map((draft) => (
                      <motion.div
                        key={draft.tempId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 xl:grid-cols-[120px_1.2fr_1fr_0.8fr_auto] gap-4 p-4 items-start"
                      >
                        <div className="h-28 rounded-2xl overflow-hidden bg-muted border border-border">
                          <img src={draft.image} alt={draft.name} className="w-full h-full object-cover" />
                        </div>

                        <div className="space-y-3">
                          <input
                            value={draft.name}
                            onChange={(event) => updateDraft(draft.tempId, { name: event.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Nombre del producto"
                          />
                          <textarea
                            value={draft.description}
                            onChange={(event) => updateDraft(draft.tempId, { description: event.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                            placeholder="Descripción corta"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Ruta visual</label>
                          <select
                            value={draft.family}
                            onChange={(event) => updateTaxonomy(draft.tempId, event.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {taxonomy.map((item) => (
                              <option key={`${item.department}-${item.area}-${item.family}`} value={item.family}>
                                {item.department} / {item.area} / {item.family}
                              </option>
                            ))}
                          </select>
                          <div className="flex flex-wrap gap-1.5 text-[11px]">
                            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary">{draft.category}</span>
                            <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">
                              {draft.aiStatus === "classified" ? "IA" : draft.aiStatus === "pending" ? "Analizando" : "Manual"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Precio opcional</label>
                          <input
                            value={draft.price}
                            onChange={(event) => updateDraft(draft.tempId, { price: event.target.value })}
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="0.00"
                          />
                          <label className="flex items-center gap-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              checked={draft.active}
                              onChange={(event) => updateDraft(draft.tempId, { active: event.target.checked })}
                            />
                            Publicar al importar
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeDraft(draft.tempId)}
                          className="p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20"
                          aria-label="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!drafts.length && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <ImagePlus className="w-6 h-6 text-primary mb-3" />
            <p className="font-semibold">Una foto = un producto</p>
            <p className="text-sm text-muted-foreground mt-1">Evita collages. Ideal para catálogo real de venta.</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <Flower2 className="w-6 h-6 text-primary mb-3" />
            <p className="font-semibold">También ramos</p>
            <p className="text-sm text-muted-foreground mt-1">Rosas, novia, silvestres, premium, tulipanes, peonías y mixtos.</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <CheckCircle2 className="w-6 h-6 text-primary mb-3" />
            <p className="font-semibold">Revisión antes de publicar</p>
            <p className="text-sm text-muted-foreground mt-1">Corriges solo lo necesario y luego importas todo junto.</p>
          </div>
        </div>
      )}
    </div>
  );
}
