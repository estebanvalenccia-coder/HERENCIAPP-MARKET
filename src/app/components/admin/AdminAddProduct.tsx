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
    category: "flores",
    featured: false,
    onSale: false,
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
      category: formData.category,
      image: imagePreview,
      featured: formData.featured,
      onSale: formData.onSale,
      active: true,
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
      category: "flores",
      featured: false,
      onSale: false,
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
