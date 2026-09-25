import { useState, useEffect } from "react";
import { Edit, Trash2, Eye, EyeOff, Tag as TagIcon, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { products as initialProducts } from "../../data/products";
import { backendStorage } from "../../lib/backendStorage";

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
  sku?: string;
  stock?: number;
  iva?: number;
  environment?: string;
  light?: string;
  size?: string;
  difficulty?: string;
  petSafe?: boolean;
  toxicity?: string;
  water?: string;
  temperature?: string;
  occasion?: string;
  allowDedication?: boolean;
  variants?: Array<{ name: string; price?: number; stock?: number }>;
  deletedAt?: string;
}

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

function getGeminiApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
}

function buildBouquetPrompt(productName: string, description: string, customPrompt: string) {
  const idea = customPrompt.trim() || `${productName}. ${description}`;

  return `Crea una imagen fotorealista, premium y comercial para una floristería elegante llamada Herencia Market.
Producto o ramo: ${idea}
Estilo: ramo de flores bonito, moderno, colorido, juvenil y elegante, con iluminación natural, fondo limpio tipo estudio, composición centrada, alta calidad, sin texto, sin logos, sin marcas de agua, apta para ecommerce.`;
}

async function generateBouquetImageWithGemini(prompt: string) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error("Falta configurar VITE_GEMINI_API_KEY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "No se pudo generar la imagen");
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part: any) => part.inlineData || part.inline_data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;

  if (!inlineData?.data) {
    throw new Error("La IA no devolvió una imagen. Prueba con una descripción más clara.");
  }

  return `data:${inlineData.mimeType || inlineData.mime_type || "image/png"};base64,${inlineData.data}`;
}

export function AdminProducts({ onAddNew }: { onAddNew: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
    image: "",
    sku: "",
    stock: 0,
    iva: 21,
    environment: "interior",
    light: "indirecta",
    size: "",
    difficulty: "Fácil",
    petSafe: false,
    toxicity: "",
    water: "",
    temperature: "",
    occasion: "",
    allowDedication: true,
    variantsText: "",
  });

  useEffect(() => {
    const saved = backendStorage.getItem("adminProducts");
    if (saved) {
      setProducts(JSON.parse(saved));
    } else {
      const productsWithState = initialProducts.map((p, index) => ({
        ...p,
        active: true,
        onSale: p.featured || false,
        salePrice: p.featured ? p.price * 0.8 : undefined,
        sku: `SKU-${String(p.id ?? index + 1).padStart(4, "0")}`,
        stock: 0,
        iva: 21,
      }));
      setProducts(productsWithState);
      backendStorage.setItem("adminProducts", JSON.stringify(productsWithState));
    }
  }, []);

  const saveProducts = (updatedProducts: Product[]) => {
    setProducts(updatedProducts);
    backendStorage.setItem("adminProducts", JSON.stringify(updatedProducts));
  };

  const toggleActive = (id: number) => {
    const updated = products.map(p =>
      p.id === id ? { ...p, active: !p.active } : p
    );
    saveProducts(updated);
    toast.success("Estado actualizado");
  };

  const toggleSale = (id: number) => {
    const updated = products.map(p => {
      if (p.id === id) {
        const newOnSale = !p.onSale;
        return {
          ...p,
          onSale: newOnSale,
          salePrice: newOnSale ? p.price * 0.8 : undefined
        };
      }
      return p;
    });
    saveProducts(updated);
    toast.success(updated.find(p => p.id === id)?.onSale ? "Oferta activada" : "Oferta desactivada");
  };

  const deleteProduct = (id: number) => {
    if (confirm("¿Mover este producto a la papelera? Podrás restaurarlo después.")) {
      const updated = products.map(p => p.id === id ? { ...p, active: false, deletedAt: new Date().toISOString() } : p);
      saveProducts(updated);
      toast.success("Producto movido a la papelera");
    }
  };

  const restoreProduct = (id: number) => {
    const updated = products.map(p => p.id === id ? { ...p, active: true, deletedAt: undefined } : p);
    saveProducts(updated);
    toast.success("Producto restaurado");
  };

  const permanentlyDeleteProduct = (id: number) => {
    if (!confirm("Esta acción es definitiva. ¿Eliminar permanentemente?")) return;
    saveProducts(products.filter(p => p.id !== id));
    toast.success("Producto eliminado permanentemente");
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setAiPrompt("");
    setEditForm({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      image: product.image,
      sku: product.sku || "",
      stock: Math.max(0, Number(product.stock || 0)),
      iva: Number(product.iva || 21),
      environment: product.environment || "interior",
      light: product.light || "indirecta",
      size: product.size || "",
      difficulty: product.difficulty || "Fácil",
      petSafe: Boolean(product.petSafe),
      toxicity: product.toxicity || "",
      water: product.water || "",
      temperature: product.temperature || "",
      occasion: product.occasion || "",
      allowDedication: product.allowDedication !== false,
      variantsText: (product.variants || []).map((v) => `${v.name} | ${v.price ?? ""} | ${v.stock ?? ""}`).join("\n"),
    });
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setAiPrompt("");
    setEditForm({ name: "", description: "", price: 0, category: "", image: "", sku: "", stock: 0, iva: 21, environment: "interior", light: "indirecta", size: "", difficulty: "Fácil", petSafe: false, toxicity: "", water: "", temperature: "", occasion: "", allowDedication: true, variantsText: "" });
  };

  const generateAiImage = async () => {
    if (!editingProduct) return;

    try {
      setAiGenerating(true);
      const prompt = buildBouquetPrompt(editForm.name, editForm.description, aiPrompt);
      const imageUrl = await generateBouquetImageWithGemini(prompt);
      setEditForm((prev) => ({ ...prev, image: imageUrl }));
      toast.success("Imagen generada con Nano Banana 🌸");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "No se pudo generar la imagen");
    } finally {
      setAiGenerating(false);
    }
  };

  const saveEdit = () => {
    if (!editingProduct) return;

    const updated = products.map(p =>
      p.id === editingProduct.id
        ? {
            ...p,
            name: editForm.name,
            description: editForm.description,
            price: editForm.price,
            category: editForm.category,
            image: editForm.image,
            sku: editForm.sku.trim() || p.sku || `SKU-${p.id}`,
            stock: Math.max(0, Math.floor(Number(editForm.stock || 0))),
            iva: Math.max(0, Number(editForm.iva || 21)),
            salePrice: p.onSale ? editForm.price * 0.8 : p.salePrice,
            environment: editForm.environment,
            light: editForm.light,
            size: editForm.size.trim(),
            difficulty: editForm.difficulty,
            petSafe: editForm.petSafe,
            toxicity: editForm.toxicity.trim(),
            water: editForm.water.trim(),
            temperature: editForm.temperature.trim(),
            occasion: editForm.occasion.trim(),
            allowDedication: editForm.allowDedication,
            variants: editForm.variantsText.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
              const [name, price, stock] = line.split("|").map((part) => part.trim());
              return { name, price: price ? Math.max(0, Number(price)) : undefined, stock: stock ? Math.max(0, Math.floor(Number(stock))) : undefined };
            }).filter((variant) => variant.name),
          }
        : p
    );
    saveProducts(updated);
    toast.success("Producto actualizado");
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestión de Productos</h2>
          <p className="text-muted-foreground">{products.filter(p=>!p.deletedAt).length} activos · {products.filter(p=>p.deletedAt).length} en papelera</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setShowTrash(!showTrash)} className="px-4 py-3 bg-muted text-foreground rounded-xl hover:bg-accent">{showTrash ? "Ver productos" : "Papelera"}</button>
          <button onClick={onAddNew} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">+ Añadir Producto</button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 gap-4">
        {products.filter((product)=>showTrash ? Boolean(product.deletedAt) : !product.deletedAt).map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-card border border-border rounded-2xl p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Image */}
              <div className="w-full sm:w-32 h-32 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg mb-1">
                      {product.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {product.onSale && (
                      <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                        OFERTA
                      </span>
                    )}
                    {!product.active && (
                      <span className="px-2 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-full">
                        OCULTO
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Precio: </span>
                    <span className={`font-bold ${product.onSale ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      €{(product.price || 0).toFixed(2)}
                    </span>
                  </div>
                  {product.onSale && product.salePrice && (
                    <div>
                      <span className="text-sm text-muted-foreground">Oferta: </span>
                      <span className="font-bold text-primary">
                        €{(product.salePrice || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-muted-foreground">Categoría: </span>
                    <span className="text-foreground capitalize">
                      {product.category.replace("-", " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Stock: </span>
                    <span className="font-bold text-foreground">{Math.max(0, Number(product.stock || 0))}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">SKU: </span>
                    <span className="text-foreground">{product.sku || `SKU-${product.id}`}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">IVA: </span>
                    <span className="text-foreground">{Number(product.iva || 21)}%</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleActive(product.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      product.active
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {product.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span className="text-sm">{product.active ? "Visible" : "Oculto"}</span>
                  </button>

                  <button
                    onClick={() => toggleSale(product.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      product.onSale
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-muted text-foreground hover:bg-accent"
                    }`}
                  >
                    <TagIcon className="w-4 h-4" />
                    <span className="text-sm">{product.onSale ? "En oferta" : "Sin oferta"}</span>
                  </button>

                  <button
                    onClick={() => startEdit(product)}
                    className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg hover:bg-accent transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="text-sm">Editar</span>
                  </button>

                  {product.deletedAt ? <>
                    <button onClick={() => restoreProduct(product.id)} className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20"><Eye className="w-4 h-4"/><span className="text-sm">Restaurar</span></button>
                    <button onClick={() => permanentlyDeleteProduct(product.id)} className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20"><Trash2 className="w-4 h-4"/><span className="text-sm">Eliminar definitivamente</span></button>
                  </> : <button onClick={() => deleteProduct(product.id)} className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20"><Trash2 className="w-4 h-4"/><span className="text-sm">Papelera</span></button>}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Editar Producto
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 p-4 bg-muted/40 rounded-2xl border border-border">
                <div className="h-56 rounded-xl overflow-hidden bg-background border border-border">
                  {editForm.image ? (
                    <img src={editForm.image} alt={editForm.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                      Sin imagen
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Imagen del producto
                    </label>
                    <input
                      type="text"
                      value={editForm.image}
                      onChange={(e) => setEditForm({ ...editForm, image: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="URL de imagen o imagen generada por IA"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Prompt para Nano Banana
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="Ej: ramo juvenil de rosas rosas, tulipanes blancos y eucalipto, muy colorido y elegante"
                    />
                  </div>

                  <button
                    onClick={generateAiImage}
                    disabled={aiGenerating}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium disabled:opacity-60"
                  >
                    <Sparkles className="w-4 h-4" />
                    {aiGenerating ? "Generando imagen..." : "Generar imagen con IA"}
                  </button>

                  <p className="text-xs text-muted-foreground">
                    Usa Nano Banana / Gemini para crear fotos de ramos y productos directamente desde el admin.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ej: Rosa Roja Premium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Descripción
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Descripción detallada del producto..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Precio (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Categoría
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="flores">Flores</option>
                    <option value="plantas-interior">Plantas de Interior</option>
                    <option value="plantas-exterior">Plantas de Exterior</option>
                    <option value="orquideas">Orquídeas</option>
                    <option value="macetas">Macetas</option>
                    <option value="sustratos">Sustratos</option>
                    <option value="fertilizantes">Fertilizantes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">SKU / Código</label>
                  <input
                    type="text"
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Stock real</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.stock}
                    onChange={(e) => setEditForm({ ...editForm, stock: Math.max(0, Math.floor(Number(e.target.value || 0))) })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">IVA (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.iva}
                    onChange={(e) => setEditForm({ ...editForm, iva: Math.max(0, Number(e.target.value || 0)) })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
                <h4 className="font-bold">Ficha avanzada</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <select value={editForm.environment} onChange={(e)=>setEditForm({...editForm,environment:e.target.value})} className="px-3 py-3 bg-background border border-border rounded-xl"><option value="interior">Interior</option><option value="exterior">Exterior</option><option value="interior exterior">Interior / exterior</option></select>
                  <select value={editForm.light} onChange={(e)=>setEditForm({...editForm,light:e.target.value})} className="px-3 py-3 bg-background border border-border rounded-xl"><option value="baja">Poca luz</option><option value="indirecta">Luz indirecta</option><option value="sol">Sol</option></select>
                  <input value={editForm.size} onChange={(e)=>setEditForm({...editForm,size:e.target.value})} placeholder="Tamaño" className="px-3 py-3 bg-background border border-border rounded-xl"/>
                  <select value={editForm.difficulty} onChange={(e)=>setEditForm({...editForm,difficulty:e.target.value})} className="px-3 py-3 bg-background border border-border rounded-xl"><option>Fácil</option><option>Media</option><option>Avanzada</option></select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={editForm.water} onChange={(e)=>setEditForm({...editForm,water:e.target.value})} placeholder="Riego" className="px-3 py-3 bg-background border border-border rounded-xl"/>
                  <input value={editForm.temperature} onChange={(e)=>setEditForm({...editForm,temperature:e.target.value})} placeholder="Temperatura" className="px-3 py-3 bg-background border border-border rounded-xl"/>
                  <input value={editForm.occasion} onChange={(e)=>setEditForm({...editForm,occasion:e.target.value})} placeholder="Ocasión / etiquetas" className="px-3 py-3 bg-background border border-border rounded-xl"/>
                  <input value={editForm.toxicity} onChange={(e)=>setEditForm({...editForm,toxicity:e.target.value})} placeholder="Toxicidad" className="px-3 py-3 bg-background border border-border rounded-xl"/>
                </div>
                <div className="flex gap-2"><button type="button" onClick={()=>setEditForm({...editForm,petSafe:!editForm.petSafe})} className={`rounded-xl border px-3 py-2 text-sm ${editForm.petSafe?"border-primary bg-primary/10 text-primary":"border-border"}`}>🐾 Mascotas</button><button type="button" onClick={()=>setEditForm({...editForm,allowDedication:!editForm.allowDedication})} className={`rounded-xl border px-3 py-2 text-sm ${editForm.allowDedication?"border-primary bg-primary/10 text-primary":"border-border"}`}>💌 Dedicatoria</button></div>
                <textarea value={editForm.variantsText} onChange={(e)=>setEditForm({...editForm,variantsText:e.target.value})} rows={4} placeholder={"Variantes: nombre | precio | stock"} className="w-full px-4 py-3 bg-background border border-border rounded-xl resize-none"/>
              </div>

              {editingProduct.onSale && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Precio de oferta automático: </span>
                    <span className="text-primary font-bold">
                      €{(editForm.price * 0.8).toFixed(2)}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveEdit}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium"
              >
                Guardar Cambios
              </button>
              <button
                onClick={cancelEdit}
                className="px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
