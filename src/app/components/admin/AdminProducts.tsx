import { useState, useEffect } from "react";
import { Edit, Trash2, Eye, EyeOff, Tag as TagIcon } from "lucide-react";
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
}

export function AdminProducts({ onAddNew }: { onAddNew: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
  });

  useEffect(() => {
    const saved = backendStorage.getItem("adminProducts");
    if (saved) {
      setProducts(JSON.parse(saved));
    } else {
      const productsWithState = initialProducts.map(p => ({
        ...p,
        active: true,
        onSale: p.featured || false,
        salePrice: p.featured ? p.price * 0.8 : undefined
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
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      const updated = products.filter(p => p.id !== id);
      saveProducts(updated);
      toast.success("Producto eliminado");
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
    });
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setEditForm({ name: "", description: "", price: 0, category: "" });
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
            salePrice: p.onSale ? editForm.price * 0.8 : p.salePrice,
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
          <p className="text-muted-foreground">{products.length} productos totales</p>
        </div>
        <button
          onClick={onAddNew}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
        >
          + Añadir Producto
        </button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 gap-4">
        {products.map((product, index) => (
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
                      ${(product.price || 0).toFixed(2)}
                    </span>
                  </div>
                  {product.onSale && product.salePrice && (
                    <div>
                      <span className="text-sm text-muted-foreground">Oferta: </span>
                      <span className="font-bold text-primary">
                        ${(product.salePrice || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-muted-foreground">Categoría: </span>
                    <span className="text-foreground capitalize">
                      {product.category.replace("-", " ")}
                    </span>
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

                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Eliminar</span>
                  </button>
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
            className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Editar Producto
            </h3>

            <div className="space-y-4">
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
                    Precio ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
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

              {editingProduct.onSale && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Precio de oferta automático: </span>
                    <span className="text-primary font-bold">
                      ${(editForm.price * 0.8).toFixed(2)}
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
