import { useState, useEffect } from "react";
import { Search, ShoppingCart, Heart, Filter } from "lucide-react";
import { motion } from "motion/react";
import { products, categories } from "../data/products";
import { toast } from "sonner";
import { useLocation, Link } from "react-router";
import { backendStorage } from "../lib/backendStorage";

export function Products() {
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [displayProducts, setDisplayProducts] = useState(products);

  // Leer categoría de la URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const categoria = params.get("categoria");
    if (categoria) {
      setSelectedCategory(categoria);
    }
  }, [location.search]);

  // Cargar productos del admin si existen
  useEffect(() => {
    const adminProducts = backendStorage.getItem("adminProducts");
    if (adminProducts) {
      const parsed = JSON.parse(adminProducts);
      // Solo mostrar productos activos
      setDisplayProducts(parsed.filter((p: any) => p.active !== false));
    }

    // Escuchar cambios en backendStorage
    const handleStorageChange = () => {
      const updated = backendStorage.getItem("adminProducts");
      if (updated) {
        const parsed = JSON.parse(updated);
        setDisplayProducts(parsed.filter((p: any) => p.active !== false));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const filteredProducts = displayProducts.filter((product) => {
    const matchesCategory = selectedCategory === "todos" || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (productId: number) => {
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    const product = displayProducts.find(p => p.id === productId);

    if (!product) {
      toast.error("Producto no encontrado");
      return;
    }

    if (!product.price || product.price <= 0) {
      toast.error("Este producto no tiene un precio válido");
      return;
    }

    const existingItem = cart.find((item: any) => item.id === productId);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }

    backendStorage.setItem("cart", JSON.stringify(cart));
    toast.success("Producto añadido al carrito");
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-muted/30 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Nuestros Productos
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Explora nuestra selección de flores, plantas y accesorios de jardinería
          </p>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
        {/* Filters and Search */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden flex items-center justify-center gap-2 px-6 py-3 bg-background border border-border rounded-xl hover:bg-accent transition-colors"
            >
              <Filter className="w-5 h-5" />
              Filtros
            </button>
          </div>

          {/* Categories */}
          <div className={`${showFilters ? 'block' : 'hidden'} sm:block`}>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    selectedCategory === category.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border text-foreground hover:bg-accent"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all"
              >
                <Link to={`/producto/${product.id}`} className="relative h-64 overflow-hidden bg-muted block cursor-pointer">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {product.featured && (
                    <div className="absolute top-3 right-3 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                      Destacado
                    </div>
                  )}
                  <button
                    onClick={(e) => e.preventDefault()}
                    className="absolute top-3 left-3 p-2 bg-background/80 backdrop-blur-sm rounded-full hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Heart className="w-5 h-5 text-foreground" />
                  </button>
                </Link>

                <div className="p-5">
                  <Link to={`/producto/${product.id}`}>
                    <h3 className="font-semibold text-foreground mb-2 line-clamp-1 hover:text-primary transition-colors cursor-pointer">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      {(product as any).onSale && (product as any).salePrice ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground line-through">
                            €{(product.price || 0).toFixed(2)}
                          </span>
                          <span className="text-xl font-bold text-primary">
                            €{((product as any).salePrice || 0).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xl font-bold text-primary">
                          €{(product.price || 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => addToCart(product.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Añadir
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
