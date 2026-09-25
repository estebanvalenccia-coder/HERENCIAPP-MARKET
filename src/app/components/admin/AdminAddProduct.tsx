import { useState } from "react";
import { ArrowLeft, Upload, X } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { categories } from "../../data/products";
import { backendStorage } from "../../lib/backendStorage";

export function AdminAddProduct({ onBack }: { onBack: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    salePrice: "",
    sku: "",
    stock: "0",
    iva: "21",
    category: "flores",
    featured: false,
    onSale: false,
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
    seoTitle: "",
    seoDescription: "",
  });
  const [imagePreview, setImagePreview] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validación detallada
    if (!imagePreview) {
      toast.error("Por favor sube una imagen del producto");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Por favor ingresa el nombre del producto");
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error("Por favor ingresa un precio válido");
      return;
    }

    if (formData.onSale && (!formData.salePrice || parseFloat(formData.salePrice) <= 0)) {
      toast.error("Por favor ingresa un precio de oferta válido");
      return;
    }

    // Obtener productos existentes
    const existingProducts = JSON.parse(backendStorage.getItem("adminProducts") || "[]");

    // Crear nuevo producto
    const newProduct = {
      id: Date.now(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: parseFloat(formData.price),
      salePrice: formData.onSale ? parseFloat(formData.salePrice) : undefined,
      sku: formData.sku.trim() || `SKU-${Date.now()}`,
      stock: Math.max(0, Math.floor(parseFloat(formData.stock) || 0)),
      iva: Math.max(0, parseFloat(formData.iva) || 21),
      category: formData.category,
      image: imagePreview,
      featured: formData.featured,
      onSale: formData.onSale,
      active: true,
      environment: formData.environment,
      light: formData.light,
      size: formData.size.trim(),
      difficulty: formData.difficulty,
      petSafe: formData.petSafe,
      toxicity: formData.toxicity.trim(),
      water: formData.water.trim(),
      temperature: formData.temperature.trim(),
      occasion: formData.occasion.trim(),
      allowDedication: formData.allowDedication,
      seoTitle: formData.seoTitle.trim() || formData.name.trim(),
      seoDescription: formData.seoDescription.trim() || formData.description.trim(),
      variants: formData.variantsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, price, stock] = line.split("|").map((part) => part.trim());
          return {
            name,
            price: price ? Math.max(0, Number(price)) : undefined,
            stock: stock ? Math.max(0, Math.floor(Number(stock))) : undefined,
          };
        })
        .filter((variant) => variant.name),
    };

    // Guardar
    const updatedProducts = [...existingProducts, newProduct];
    backendStorage.setItem("adminProducts", JSON.stringify(updatedProducts));

    // Disparar evento para actualizar otros componentes
    window.dispatchEvent(new Event('storage'));

    toast.success(`✅ Producto "${newProduct.name}" añadido correctamente`);

    // Limpiar formulario
    setFormData({
      name: "",
      description: "",
      price: "",
      salePrice: "",
      sku: "",
      stock: "0",
      iva: "21",
      category: "flores",
      featured: false,
      onSale: false,
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
      seoTitle: "",
      seoDescription: "",
    });
    setImagePreview("");

    // Volver a la lista de productos
    setTimeout(() => {
      onBack();
    }, 500);
  };

  return (
    <div className="max-w-4xl">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a productos
      </button>

      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-foreground mb-6">Añadir Nuevo Producto</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Imagen del Producto *
            </label>
            {imagePreview ? (
              <div className="relative w-full h-64 rounded-xl overflow-hidden bg-muted">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImagePreview("")}
                  className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
                <Upload className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-sm text-foreground font-medium mb-1">
                  Click para subir imagen
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG hasta 10MB
                </p>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </label>
            )}
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Nombre del Producto *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Ramo de Rosas Rojas"
              required
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción del producto..."
              rows={4}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Price and Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Precio Normal *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  required
                  className="w-full pl-8 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Categoría
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {categories.filter(c => c.id !== "todos").map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">SKU / Código</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Ej: RAM-001"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Stock real *</label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">IVA (%) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.iva}
                onChange={(e) => setFormData({ ...formData, iva: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-4">
            <div>
              <h3 className="text-lg font-bold">Ficha avanzada y cuidados</h3>
              <p className="text-sm text-muted-foreground">Estos campos alimentan los filtros y la ficha de producto.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="text-sm font-medium">Ubicación
                <select value={formData.environment} onChange={(e)=>setFormData({...formData,environment:e.target.value})} className="mt-2 w-full px-3 py-3 bg-background border border-border rounded-xl">
                  <option value="interior">Interior</option><option value="exterior">Exterior</option><option value="interior exterior">Interior / exterior</option>
                </select>
              </label>
              <label className="text-sm font-medium">Luz
                <select value={formData.light} onChange={(e)=>setFormData({...formData,light:e.target.value})} className="mt-2 w-full px-3 py-3 bg-background border border-border rounded-xl">
                  <option value="baja">Poca luz</option><option value="indirecta">Luz indirecta</option><option value="sol">Sol</option>
                </select>
              </label>
              <label className="text-sm font-medium">Tamaño
                <input value={formData.size} onChange={(e)=>setFormData({...formData,size:e.target.value})} placeholder="Ej: 40-60 cm" className="mt-2 w-full px-3 py-3 bg-background border border-border rounded-xl"/>
              </label>
              <label className="text-sm font-medium">Dificultad
                <select value={formData.difficulty} onChange={(e)=>setFormData({...formData,difficulty:e.target.value})} className="mt-2 w-full px-3 py-3 bg-background border border-border rounded-xl">
                  <option>Fácil</option><option>Media</option><option>Avanzada</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium">Riego
                <input value={formData.water} onChange={(e)=>setFormData({...formData,water:e.target.value})} placeholder="Ej: 1 vez por semana" className="mt-2 w-full px-3 py-3 bg-background border border-border rounded-xl"/>
              </label>
              <label className="text-sm font-medium">Temperatura
                <input value={formData.temperature} onChange={(e)=>setFormData({...formData,temperature:e.target.value})} placeholder="Ej: 18-24 °C" className="mt-2 w-full px-3 py-3 bg-background border border-border rounded-xl"/>
              </label>
              <label className="text-sm font-medium">Ocasión / etiquetas
                <input value={formData.occasion} onChange={(e)=>setFormData({...formData,occasion:e.target.value})} placeholder="Cumpleaños, boda, regalo…" className="mt-2 w-full px-3 py-3 bg-background border border-border rounded-xl"/>
              </label>
              <label className="text-sm font-medium">Toxicidad / mascotas
                <input value={formData.toxicity} onChange={(e)=>setFormData({...formData,toxicity:e.target.value})} placeholder="Ej: No tóxica / tóxica para gatos" className="mt-2 w-full px-3 py-3 bg-background border border-border rounded-xl"/>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={()=>setFormData({...formData,petSafe:!formData.petSafe})} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${formData.petSafe?"border-primary bg-primary/10 text-primary":"border-border"}`}>🐾 Apta para mascotas</button>
              <button type="button" onClick={()=>setFormData({...formData,allowDedication:!formData.allowDedication})} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${formData.allowDedication?"border-primary bg-primary/10 text-primary":"border-border"}`}>💌 Permitir dedicatoria</button>
            </div>
            <label className="block text-sm font-medium">Variantes
              <textarea value={formData.variantsText} onChange={(e)=>setFormData({...formData,variantsText:e.target.value})} rows={4} placeholder={"Una por línea: nombre | precio | stock\nPequeña | 19.90 | 5\nGrande | 29.90 | 3"} className="mt-2 w-full px-4 py-3 bg-background border border-border rounded-xl resize-none"/>
            </label>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <h3 className="text-lg font-bold">SEO del producto</h3>
              <p className="text-sm text-muted-foreground">Controla cómo aparece esta ficha en buscadores y al compartirla.</p>
            </div>
            <label className="block text-sm font-medium">Título SEO
              <input value={formData.seoTitle} onChange={(e)=>setFormData({...formData,seoTitle:e.target.value.slice(0,70)})} placeholder={formData.name || "Título para Google"} className="mt-2 w-full px-4 py-3 bg-background border border-border rounded-xl"/>
              <span className="mt-1 block text-xs text-muted-foreground">{formData.seoTitle.length}/70</span>
            </label>
            <label className="block text-sm font-medium">Meta descripción
              <textarea value={formData.seoDescription} onChange={(e)=>setFormData({...formData,seoDescription:e.target.value.slice(0,170)})} rows={3} placeholder={formData.description || "Descripción para resultados de búsqueda"} className="mt-2 w-full px-4 py-3 bg-background border border-border rounded-xl resize-none"/>
              <span className="mt-1 block text-xs text-muted-foreground">{formData.seoDescription.length}/170</span>
            </label>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div>
                <p className="font-medium text-foreground">Producto en Oferta</p>
                <p className="text-sm text-muted-foreground">Activar precio especial</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, onSale: !formData.onSale })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.onSale ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    formData.onSale ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>

            {formData.onSale && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <label className="block text-sm font-medium text-foreground mb-2">
                  Precio en Oferta
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </motion.div>
            )}

            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div>
                <p className="font-medium text-foreground">Producto Destacado</p>
                <p className="text-sm text-muted-foreground">Aparece en la página principal</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, featured: !formData.featured })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.featured ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    formData.featured ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium"
            >
              Guardar Producto
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
