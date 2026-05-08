import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Wand2, Plus, Image as ImageIcon, RefreshCw, Save, Flower2, Euro, Palette, Ruler, Inbox, Eye, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { products as initialProducts } from "../../data/products";
import { backendApi, backendStorage } from "../../lib/backendStorage";

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  featured?: boolean;
  active?: boolean;
  onSale?: boolean;
  salePrice?: number;
}

interface AIBouquetProposal {
  name: string;
  shortDescription?: string;
  description: string;
  recommendedFlowers?: string[];
  sellingTip?: string;
  sellingTips?: string;
  title?: string;
}

interface FlowerRequest {
  id: string;
  customerName: string;
  total: number;
  status: string;
  date: string;
  items: Array<{ name?: string; image?: string; price?: number; quantity?: number }>;
  metadata?: any;
}

const bouquetImages = [
  "https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1559563362-c667ba5f5480?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1591886960571-74d43a9d4166?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1562690868-60bbe7293e94?q=80&w=1200&auto=format&fit=crop",
];

const flowerSuggestions = [
  { name: "Rosa Roja", price: 1.8, image: "🌹" },
  { name: "Rosa Blanca", price: 1.8, image: "🤍" },
  { name: "Tulipán Rosa", price: 1.5, image: "🌷" },
  { name: "Lirio Blanco", price: 2.2, image: "🌼" },
  { name: "Paniculata", price: 0.6, image: "✨" },
  { name: "Eucalipto", price: 1.2, image: "🌿" },
];

const styles = ["Romántico", "Elegante", "Natural", "Moderno", "Colorido", "Premium"];
const colors = ["Rojo", "Rosa", "Blanco", "Crema", "Amarillo", "Lila", "Mix"];
const sizes = [
  { id: "S", label: "Pequeño" },
  { id: "M", label: "Mediano" },
  { id: "L", label: "Grande" },
  { id: "XL", label: "Extra grande" },
];

function suggestedName(description: string, color: string) {
  const clean = description.trim().replace(/^quiero\s+/i, "");
  if (!clean) return `Ramo ${color} Herencia`;
  const base = clean.length > 34 ? `${clean.slice(0, 34)}...` : clean;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function createLocalProposal(description: string, budget: number, style: string, color: string, size: string): AIBouquetProposal {
  const name = suggestedName(description, color);
  const recommendedFlowers = color === "Rojo"
    ? ["Rosa Roja", "Eucalipto", "Paniculata", "Ruscus Verde"]
    : color === "Blanco"
      ? ["Rosa Blanca", "Lirio Blanco", "Paniculata", "Eucalipto"]
      : color === "Amarillo"
        ? ["Girasol", "Rosa Crema", "Eucalipto", "Paniculata"]
        : ["Rosa Rosa", "Tulipán", "Paniculata", "Eucalipto"];

  return {
    name,
    shortDescription: `Ramo ${style.toLowerCase()} tamaño ${size} desde ${Number(budget || 0).toFixed(2)} €`,
    description: `Ramo ${style.toLowerCase()} en tonos ${color.toLowerCase()}, pensado para Herencia Market. Una composición fresca, bonita y comercial para regalar en ocasiones especiales.`,
    recommendedFlowers,
    sellingTip: "Ideal para vender como ramo premium personalizado.",
  };
}

function pickImage(description: string, color: string, style: string) {
  const seed = `${description}-${color}-${style}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return bouquetImages[seed % bouquetImages.length];
}

function isFloresRequest(order: FlowerRequest) {
  return order.metadata?.source === "FLORES_TABLET" || order.metadata?.type === "flower_admin_request";
}

function proposalFromRequest(request: FlowerRequest): AIBouquetProposal {
  const meta = request.metadata || {};
  const rawProposal = meta.proposal || {};
  const item = request.items?.[0] || {};
  return {
    name: rawProposal.name || rawProposal.title || item.name || "Ramo solicitado desde FLORES",
    shortDescription: rawProposal.shortDescription || meta.selectedSummary || "Solicitud enviada desde la tablet FLORES",
    description: rawProposal.description || meta.idea || "Solicitud floral enviada desde la tablet de clientes.",
    recommendedFlowers: rawProposal.recommendedFlowers || meta.flowers || [],
    sellingTip: rawProposal.sellingTip || rawProposal.sellingTips || "Revisar y ajustar antes de publicar.",
  };
}

function imageFromRequest(request: FlowerRequest) {
  return request.metadata?.image?.imageUrl || request.items?.[0]?.image || "";
}

async function generateBouquetFromBackend(payload: {
  description: string;
  budget: number;
  style: string;
  color: string;
  size: string;
}) {
  if (!backendApi.baseUrl) {
    throw new Error("Falta VITE_API_URL para conectar con el backend");
  }

  const data = await backendApi.generateBouquet(payload);

  if (!data?.image) {
    throw new Error("La IA respondió, pero no devolvió imagen");
  }

  return data as { proposal: AIBouquetProposal; image: string; imageGeneratedByAi: boolean };
}

function extractErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "No se pudo conectar con la IA";
  return error.message;
}

export function AdminAIBouquetDesigner() {
  const [description, setDescription] = useState("Ramo elegante de rosas rojas, eucalipto y paniculata con toque romántico");
  const [budget, setBudget] = useState(49.9);
  const [style, setStyle] = useState("Romántico");
  const [color, setColor] = useState("Rojo");
  const [size, setSize] = useState("M");
  const [generatedImage, setGeneratedImage] = useState("");
  const [proposal, setProposal] = useState<AIBouquetProposal | null>(null);
  const [history, setHistory] = useState<Array<{ name: string; image: string; price: number; style: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [imageGeneratedByAi, setImageGeneratedByAi] = useState(false);
  const [flowerRequests, setFlowerRequests] = useState<FlowerRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const fallbackName = useMemo(() => suggestedName(description, color), [description, color]);
  const productName = proposal?.name || proposal?.title || fallbackName;
  const productDescription = proposal?.description || `Ramo ${style.toLowerCase()} en tonos ${color.toLowerCase()}, diseñado para Herencia Market. Ideal para regalo, ocasiones especiales y detalles únicos.`;

  const loadFlowerRequests = () => {
    setRequestsLoading(true);
    backendApi.listOrders()
      .then(({ orders }) => setFlowerRequests((orders || []).filter(isFloresRequest)))
      .catch((error) => {
        console.error("No se pudieron cargar las solicitudes FLORES", error);
        toast.error("No se pudieron cargar las solicitudes FLORES");
      })
      .finally(() => setRequestsLoading(false));
  };

  useEffect(() => {
    loadFlowerRequests();
  }, []);

  const applyGeneratedBouquet = (nextProposal: AIBouquetProposal, imageUrl: string, aiImage = false, nextBudget = budget, nextStyle = style) => {
    setProposal(nextProposal);
    setGeneratedImage(imageUrl);
    setImageGeneratedByAi(aiImage);
    setHistory((prev) => [
      { name: nextProposal.name || nextProposal.title || fallbackName, image: imageUrl, price: nextBudget, style: nextStyle },
      ...prev,
    ].slice(0, 6));
  };

  const openFlowerRequest = (request: FlowerRequest) => {
    const meta = request.metadata || {};
    const nextProposal = proposalFromRequest(request);
    const nextImage = imageFromRequest(request);

    setSelectedRequestId(request.id);
    setDescription(meta.idea || nextProposal.description || "");
    setBudget(Number(meta.budget || request.total || 0));
    setStyle(meta.style || "Romántico");
    setColor(Array.isArray(meta.colors) ? meta.colors[0] || "Mix" : "Mix");
    setProposal(nextProposal);
    setGeneratedImage(nextImage);
    setImageGeneratedByAi(Boolean(nextImage));
    toast.success("Solicitud FLORES abierta en el diseñador");
  };

  const markRequestAsProcessed = async (requestId: string) => {
    try {
      await backendApi.updateOrderStatus(requestId, "completed");
      setFlowerRequests((current) => current.map((item) => item.id === requestId ? { ...item, status: "completed" } : item));
      toast.success("Solicitud marcada como revisada");
    } catch {
      toast.error("No se pudo actualizar la solicitud");
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error("Describe el ramo que quieres generar");
      return;
    }

    setLoading(true);

    try {
      const result = await generateBouquetFromBackend({ description, budget, style, color, size });
      applyGeneratedBouquet(result.proposal, result.image, result.imageGeneratedByAi);
      toast.success(result.imageGeneratedByAi ? "Imagen generada con IA real 🌸" : "Propuesta generada; imagen de respaldo aplicada 🌸");
    } catch (error) {
      const message = extractErrorMessage(error);
      const fallbackProposal = createLocalProposal(description, budget, style, color, size);
      const imageUrl = pickImage(description, color, style);

      applyGeneratedBouquet(fallbackProposal, imageUrl, false);
      toast.error(message);
      toast.message("He dejado una imagen de respaldo para que puedas seguir trabajando.");
    } finally {
      setLoading(false);
    }
  };

  const saveAsProduct = () => {
    if (!generatedImage) {
      toast.error("Primero genera o abre una imagen del ramo");
      return;
    }

    const saved = backendStorage.getItem("adminProducts");
    const currentProducts: Product[] = saved
      ? JSON.parse(saved)
      : initialProducts.map((p) => ({ ...p, active: true }));

    const nextId = Math.max(0, ...currentProducts.map((p) => Number(p.id) || 0)) + 1;

    const newProduct: Product = {
      id: nextId,
      name: productName,
      category: "flores",
      price: Number(budget) || 0,
      image: generatedImage,
      description: productDescription,
      featured: true,
      active: true,
      onSale: false,
    };

    backendStorage.setItem("adminProducts", JSON.stringify([newProduct, ...currentProducts]));

    if (selectedRequestId) {
      markRequestAsProcessed(selectedRequestId);
    }

    toast.success("Ramo guardado como producto del catálogo ✨");
  };

  const recommendedFlowers = proposal?.recommendedFlowers?.length
    ? proposal.recommendedFlowers.map((name) => ({ name, price: 0, image: "🌸" }))
    : flowerSuggestions;

  const pendingRequests = flowerRequests.filter((request) => request.status !== "completed" && request.status !== "cancelled");

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-foreground">Diseñador IA de Ramos</h2>
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">PRO</span>
            {pendingRequests.length > 0 && <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{pendingRequests.length} desde FLORES</span>}
          </div>
          <p className="text-muted-foreground mt-1">Crea ramos, recibe solicitudes desde la tablet FLORES y publícalas en el catálogo.</p>
        </div>
        <button onClick={loadFlowerRequests} className="px-4 py-2 bg-muted hover:bg-accent rounded-xl text-sm font-medium">
          {requestsLoading ? "Actualizando..." : "Actualizar FLORES"}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Solicitudes recibidas desde la tablet FLORES</h3>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">No se mezclan con pedidos reales</span>
        </div>

        {flowerRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aún no hay solicitudes de la tablet. Cuando el cliente cree un ramo en FLORES y lo envíe, aparecerá aquí.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {flowerRequests.map((request) => {
              const meta = request.metadata || {};
              const requestProposal = proposalFromRequest(request);
              const requestImage = imageFromRequest(request);
              const reviewed = request.status === "completed";

              return (
                <article key={request.id} className={`border rounded-2xl p-4 bg-background/60 ${selectedRequestId === request.id ? "border-primary shadow-md" : "border-border"}`}>
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0">
                      {requestImage ? <img src={requestImage} alt={requestProposal.name} className="w-full h-full object-cover" /> : <Flower2 className="w-8 h-8 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ${reviewed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {reviewed ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {reviewed ? "Revisada" : "Pendiente"}
                        </span>
                      </div>
                      <h4 className="font-bold truncate">{requestProposal.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{meta.selectedSummary || requestProposal.description}</p>
                      <p className="text-sm font-bold mt-2">€{Number(meta.budget || request.total || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    <p><strong>Idea:</strong> {meta.idea || "Sin idea escrita"}</p>
                    <p><strong>Fecha:</strong> {request.date ? new Date(request.date).toLocaleString("es-ES") : "Sin fecha"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button onClick={() => openFlowerRequest(request)} className="flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90">
                      <Eye className="w-4 h-4" /> Abrir
                    </button>
                    <button onClick={() => markRequestAsProcessed(request.id)} className="flex items-center justify-center gap-2 py-2 bg-muted hover:bg-accent rounded-xl text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> Revisada
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_360px] gap-6">
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</span>
              <h3 className="font-bold text-foreground">Describe tu ramo</h3>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-background border border-border rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Ej: quiero un ramo de rosas rosas y blancas, elegante y romántico"
            />
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</span>
              <h3 className="font-bold text-foreground">Personaliza</h3>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2"><Euro className="w-4 h-4" />Presupuesto</label>
              <div className="flex gap-3">
                <input type="range" min="20" max="200" step="5" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="flex-1" />
                <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value) || 0)} className="w-24 bg-background border border-border rounded-xl px-3 py-2" />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2"><Sparkles className="w-4 h-4" />Estilo</label>
              <div className="grid grid-cols-2 gap-2">
                {styles.map((item) => (
                  <button key={item} onClick={() => setStyle(item)} className={`px-3 py-2 rounded-xl border text-sm ${style === item ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}>{item}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2"><Palette className="w-4 h-4" />Color principal</label>
              <div className="flex flex-wrap gap-2">
                {colors.map((item) => (
                  <button key={item} onClick={() => setColor(item)} className={`px-3 py-2 rounded-xl border text-sm ${color === item ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}>{item}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2"><Ruler className="w-4 h-4" />Tamaño</label>
              <div className="grid grid-cols-4 gap-2">
                {sizes.map((item) => (
                  <button key={item.id} onClick={() => setSize(item.id)} className={`px-3 py-3 rounded-xl border text-sm ${size === item.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}>
                    <span className="block font-bold">{item.id}</span>
                    <span className="block text-[10px] opacity-80">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleGenerate} disabled={loading} className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-bold disabled:opacity-60">
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
              {loading ? "Generando imagen con IA..." : "Generar ramo"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Resultado / solicitud abierta</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${imageGeneratedByAi ? "bg-green-500/10 text-green-700" : "bg-primary/10 text-primary"}`}>
                {imageGeneratedByAi ? "Imagen IA" : "Catálogo"}
              </span>
            </div>

            <div className="aspect-[4/3] rounded-2xl bg-muted overflow-hidden border border-border flex items-center justify-center">
              {generatedImage ? (
                <motion.img key={generatedImage} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} src={generatedImage} alt={productName} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-8"><ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Aquí aparecerá la foto del ramo generado o enviado desde FLORES.</p></div>
              )}
            </div>

            <div className="mt-5 p-5 bg-muted/40 rounded-2xl border border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground">{productName}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{productDescription}</p>
                  {(proposal?.sellingTip || proposal?.sellingTips) && <p className="text-sm text-primary font-semibold mt-3">{proposal.sellingTip || proposal.sellingTips}</p>}
                  <p className="text-3xl font-bold mt-4">{Number(budget || 0).toFixed(2)} €</p>
                </div>
                <span className="px-2 py-1 bg-amber-500/10 text-amber-600 rounded-full text-xs font-semibold">Sugerido</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                <button onClick={saveAsProduct} className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-medium"><Plus className="w-4 h-4" /> Usar como producto</button>
                <button onClick={handleGenerate} disabled={loading} className="flex items-center justify-center gap-2 py-3 bg-background border border-border rounded-xl hover:bg-muted font-medium disabled:opacity-60"><RefreshCw className="w-4 h-4" /> Otra versión</button>
                <button onClick={() => generatedImage ? toast.success("Imagen lista para guardar en el producto") : toast.error("Primero genera una imagen")} className="flex items-center justify-center gap-2 py-3 bg-background border border-border rounded-xl hover:bg-muted font-medium"><Save className="w-4 h-4" /> Guardar imagen</button>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-foreground mb-4">Flores sugeridas para este ramo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendedFlowers.map((flower) => (
                <div key={flower.name} className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl p-3">
                  <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center text-2xl">{flower.image}</div>
                  <div className="flex-1"><p className="font-semibold text-sm">{flower.name}</p><p className="text-xs text-muted-foreground">{flower.price ? `${flower.price.toFixed(2)} € / ud` : "Sugerida"}</p></div>
                  <button className="w-8 h-8 rounded-lg bg-background border border-border hover:bg-primary hover:text-primary-foreground transition-colors">+</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-foreground">Historial de generaciones</h3><button className="text-primary text-sm">Ver todas</button></div>
            <div className="space-y-3">
              {history.length === 0 && <p className="text-sm text-muted-foreground">Todavía no has generado ramos en esta sesión.</p>}
              {history.map((item, index) => (
                <button key={`${item.name}-${index}`} onClick={() => setGeneratedImage(item.image)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted text-left">
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{item.name}</p><p className="text-xs text-muted-foreground">{item.style}</p><p className="font-bold text-sm">{item.price.toFixed(2)} €</p></div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4"><Flower2 className="w-5 h-5 text-primary" /><h3 className="font-bold text-foreground">Acciones rápidas</h3></div>
            <div className="grid gap-3">
              <button onClick={saveAsProduct} className="flex items-center gap-3 p-4 bg-muted/40 hover:bg-muted rounded-xl text-left"><Plus className="w-5 h-5 text-primary" /><div><p className="font-semibold">Importar al catálogo</p><p className="text-xs text-muted-foreground">Crear producto con imagen</p></div></button>
              <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-3 p-4 bg-muted/40 hover:bg-muted rounded-xl text-left disabled:opacity-60"><Wand2 className="w-5 h-5 text-primary" /><div><p className="font-semibold">Generar otra propuesta</p><p className="text-xs text-muted-foreground">Nueva versión del ramo</p></div></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
