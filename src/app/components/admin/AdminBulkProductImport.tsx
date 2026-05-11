import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Flower2,
  ImagePlus,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";

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
    area: "Tropicales",
    family: "Aglaonemas",
    category: "plantas-interior",
    keywords: ["aglaonema", "fucsia", "pink", "red", "silver", "lipstick", "aurora"],
    description: "Aglaonema de hojas llamativas, muy decorativa y perfecta para dar color a interiores.",
  },
  {
    department: "Plantas",
    area: "Tropicales",
    family: "Alocasias",
    category: "plantas-interior",
    keywords: ["alocasia", "frydek", "jacklyn", "black velvet", "regal", "marquesa", "silver dragon", "dragon scale"],
    description: "Alocasia tropical de hojas espectaculares, ideal para amantes de plantas especiales.",
  },
  {
    department: "Plantas",
    area: "Tropicales",
    family: "Bromelias",
    category: "plantas-interior",
    keywords: ["bromelia", "guzmania", "vriesea", "neoregelia", "aechmea", "tillandsia"],
    description: "Bromelia tropical de colores vivos, perfecta para regalar o decorar interiores con alegría.",
  },
  {
    department: "Plantas",
    area: "Tropicales",
    family: "Philodendron y Monstera",
    category: "plantas-interior",
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
    category: "cactus",
    keywords: ["mammillaria", "rebutia", "gymnocalycium", "astrophytum", "parodia", "mini cactus", "cactus pequeño"],
    description: "Cactus pequeño individual, fácil de cuidar y perfecto para detalles o decoración.",
  },
  {
    department: "Plantas",
    area: "Cactus y suculentas",
    family: "Cactus grandes",
    category: "cactus",
    keywords: ["cereus", "trichocereus", "ferocactus", "echinocactus", "grusonii", "cactus grande", "candelabro"],
    description: "Cactus grande individual, decorativo, resistente y de gran presencia para interior luminoso o terraza protegida.",
  },
  {
    department: "Plantas",
    area: "Cactus y suculentas",
    family: "Suculentas",
    category: "suculentas",
    keywords: ["suculenta", "echeveria", "sedum", "crassula", "haworthia", "aloe", "aeonium", "graptopetalum", "pachyphytum"],
    description: "Suculenta individual, bonita, resistente y fácil de mantener.",
  },
  {
    department: "Plantas",
    area: "Cactus y suculentas",
    family: "Euphorbias",
    category: "cactus",
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

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function dataUrlToGeminiImage(image: string) {
  const [header, data] = image.split(",");
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  return { mimeType, data };
}

function getGeminiApiKey() {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GOOGLE_API_KEY ||
    import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  );
}

function normalizeAiTaxonomy(result: any, fallback: TaxonomyOption) {
  const family = String(result?.family || result?.subcategory || fallback.family);
  const matching = taxonomy.find((item) => item.family.toLowerCase() === family.toLowerCase());
  return matching || fallback;
}

async function classifyWithGemini(draft: ProductDraft): Promise<Partial<ProductDraft>> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Falta VITE_GEMINI_API_KEY para clasificar con IA");

  const image = dataUrlToGeminiImage(draft.image);
  const allowedFamilies = taxonomy
    .map((item) => `${item.department} > ${item.area} > ${item.family} (${item.category})`)
    .join("\n");

  const prompt = `Eres una IA experta en catálogo de floristería y garden center en Barcelona.
Analiza esta imagen. Puede ser UNA planta individual o UN ramo de flores.
Responde SOLO JSON válido. No inventes precios.
Usa una de estas rutas:
${allowedFamilies}

Formato obligatorio:
{
  "name": "Nombre comercial en español",
  "department": "Ramos de flores/Plantas",
  "area": "Área exacta de la lista",
  "family": "Familia exacta de la lista",
  "category": "flores/plantas-interior/plantas-exterior/orquideas/cactus/suculentas",
  "description": "Descripción breve para tienda online, máximo 18 palabras",
  "confidence": 0.0
}`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: image.mimeType, data: image.data } },
            ],
          },
        ],
      }),
    }
  );

  const text = await response.text();
  if (!response.ok) throw new Error(text || "La IA no pudo clasificar la imagen");

  const parsed = JSON.parse(text);
  const output = parsed?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("\n") || "";
  const json = extractJson(output);
  if (!json) throw new Error("La IA respondió sin JSON válido");

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
    active: true,
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

export function AdminBulkProductImport({ onBack }: { onBack: () => void }) {
  const [drafts, setDrafts] = useState<ProductDraft[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groupedDrafts = useMemo(() => {
    return drafts.reduce<Record<string, ProductDraft[]>>((groups, draft) => {
      const key = `${draft.department} > ${draft.area} > ${draft.family}`;
      groups[key] = groups[key] || [];
      groups[key].push(draft);
      return groups;
    }, {});
  }, [drafts]);

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

    const existingProducts = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
    const startId = Date.now();

    const newProducts = drafts.map((draft, index) => ({
      id: startId + index,
      name: draft.name.trim() || draft.family,
      description: draft.description.trim() || "Producto de floristería seleccionado para Herencia Market.",
      price: Number(draft.price || 0),
      category: draft.category,
      department: draft.department,
      area: draft.area,
      family: draft.family,
      subcategory: draft.family,
      image: draft.image,
      featured: draft.featured,
      onSale: false,
      active: draft.active,
    }));

    await backendStorage.setItem("adminProducts", JSON.stringify([...existingProducts, ...newProducts]));
    window.dispatchEvent(new Event("storage"));

    toast.success(`✅ ${newProducts.length} productos importados al admin`);
    setDrafts([]);
    onBack();
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
              Sirve para plantas y también para ramos. Todo queda agrupado en desplegables para que el admin no se vea cargado.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
                            Visible
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
