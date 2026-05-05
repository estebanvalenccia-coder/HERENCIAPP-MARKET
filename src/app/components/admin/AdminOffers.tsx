import { useState, useEffect } from "react";
import { Tag, TrendingDown } from "lucide-react";
import { motion } from "motion/react";
import { backendStorage } from "../../lib/backendStorage";

export function AdminOffers() {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const saved = backendStorage.getItem("adminProducts");
    if (saved) {
      const all = JSON.parse(saved);
      setProducts(all.filter((p: any) => p.onSale));
    }
  }, []);

  const calculateDiscount = (price: number, salePrice: number) => {
    return Math.round(((price - salePrice) / price) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-3 rounded-xl">
          <Tag className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Productos en Oferta</h2>
          <p className="text-muted-foreground">{products.length} productos con descuento</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-2xl">
          <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay productos en oferta</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all"
            >
              <div className="relative h-48">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-bold">
                  -{calculateDiscount(product.price, product.salePrice || product.price)}%
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-foreground mb-2">{product.name}</h3>

                <div className="flex items-center gap-3 mb-4">
                  <span className="text-lg font-bold text-muted-foreground line-through">
                    ${(product.price || 0).toFixed(2)}
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    ${(product.salePrice || product.price || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingDown className="w-4 h-4 text-primary" />
                  <span>
                    Ahorras ${((product.price || 0) - (product.salePrice || product.price || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
