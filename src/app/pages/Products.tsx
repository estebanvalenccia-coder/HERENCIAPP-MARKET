import { useMemo, useState, useEffect } from "react";
import { Search, ShoppingCart, Heart, Filter, SlidersHorizontal, X } from "lucide-react";
import { motion } from "motion/react";
import { products, categories } from "../data/products";
import { toast } from "sonner";
import { useLocation, Link } from "react-router";
import { backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, parseSiteContent, SiteContent } from "../lib/siteContent";

const normalize = (value: unknown) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const fuzzyMatch = (haystack: string, query: string) => {
  const text = normalize(haystack);
  const q = normalize(query);
  if (!q) return true;
  if (text.includes(q)) return true;
  return q.split(/\s+/).every((token) => token.length < 3 ? text.includes(token) : text.split(/\s+/).some((word) => word.includes(token) || token.includes(word)));
};

export function Products() {
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [displayProducts, setDisplayProducts] = useState<any[]>(products);
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [sort, setSort] = useState("relevance");
  const [availability, setAvailability] = useState("all");
  const [maxPrice, setMaxPrice] = useState<number>(500);
  const [environment, setEnvironment] = useState("all");
  const [light, setLight] = useState("all");
  const [petSafe, setPetSafe] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const categoria = params.get("categoria");
    const buscar = params.get("buscar");
    if (categoria) setSelectedCategory(categoria);
    if (buscar !== null) setSearchQuery(buscar);
  }, [location.search]);

  useEffect(() => {
    const load = () => {
      const adminProducts = backendStorage.getItem("adminProducts");
      if (adminProducts) {
        try {
          const parsed = JSON.parse(adminProducts);
          setDisplayProducts(Array.isArray(parsed) ? parsed.filter((product: any) => product.active !== false) : []);
        } catch { setDisplayProducts(products); }
      }
      setSite(parseSiteContent(backendStorage.getItem("siteContent")));
      try { setFavorites(JSON.parse(backendStorage.getItem("wishlist") || "[]").map(String)); } catch { setFavorites([]); }
      backendApi.customerWishlist().then((r) => {
        const ids=(r.wishlist||[]).map(String);
        setFavorites(ids);
        void backendStorage.setItem("wishlist", JSON.stringify(ids));
      }).catch(()=>{});
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener("backend-storage", load); };
  }, []);

  const suggestions = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    return displayProducts.filter((p) => fuzzyMatch(`${p.name} ${p.description} ${p.category} ${p.tags || ""}`, searchQuery)).slice(0, 5);
  }, [displayProducts, searchQuery]);

  const filteredProducts = useMemo(() => {
    const rows = displayProducts.filter((product) => {
      const stock = Math.max(0, Number(product.stock || 0));
      const price = Number(product.onSale && product.salePrice ? product.salePrice : product.price || 0);
      const searchText = [product.name, product.description, product.category, product.tags, product.occasion, product.light, product.environment, product.size].filter(Boolean).join(" ");
      const matchesCategory = selectedCategory === "todos" || String(product.category || "") === selectedCategory;
      const matchesSearch = fuzzyMatch(searchText, searchQuery);
      const matchesAvailability = availability === "all" || (availability === "available" ? stock > 0 : stock <= 0);
      const matchesPrice = price <= maxPrice;
      const env = normalize(product.environment || product.location || "");
      const matchesEnvironment = environment === "all" || env.includes(environment);
      const lightText = normalize(product.light || product.care?.light || "");
      const matchesLight = light === "all" || lightText.includes(light);
      const safe = product.petSafe === true || normalize(product.toxicity).includes("no tox") || normalize(product.toxicity).includes("segur");
      return matchesCategory && matchesSearch && matchesAvailability && matchesPrice && matchesEnvironment && matchesLight && (!petSafe || safe);
    });

    return [...rows].sort((a, b) => {
      const ap = Number(a.onSale && a.salePrice ? a.salePrice : a.price || 0);
      const bp = Number(b.onSale && b.salePrice ? b.salePrice : b.price || 0);
      if (sort === "price-asc") return ap - bp;
      if (sort === "price-desc") return bp - ap;
      if (sort === "newest") return Number(b.id || 0) - Number(a.id || 0);
      if (sort === "stock") return Number(b.stock || 0) - Number(a.stock || 0);
      if (sort === "featured") return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      return 0;
    });
  }, [displayProducts, selectedCategory, searchQuery, availability, maxPrice, environment, light, petSafe, sort]);

  const toggleFavorite = async (productId: any) => {
    const id = String(productId);
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    await backendStorage.setItem("wishlist", JSON.stringify(next));
    backendApi.customerSaveWishlist(next).catch(()=>null);
    toast.success(next.includes(id) ? "Añadido a favoritos" : "Eliminado de favoritos");
  };

  const addToCart = (productId: any) => {
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    const product = displayProducts.find((item) => String(item.id) === String(productId));
    if (!product) return toast.error("Producto no encontrado");
    if (!product.price || Number(product.price) <= 0) return toast.error("Este producto no tiene un precio válido");
    const stock = Math.max(0, Math.floor(Number(product.stock || 0)));
    if (stock <= 0) return toast.error(site.productsPage.outOfStockText);
    const existingItem = cart.find((item: any) => String(item.id) === String(productId));
    const nextQuantity = Number(existingItem?.quantity || 0) + 1;
    if (nextQuantity > stock) return toast.error(`Solo quedan ${stock} unidades disponibles`);
    if (existingItem) existingItem.quantity = nextQuantity; else cart.push({ ...product, quantity: 1 });
    void backendStorage.setItem("cart", JSON.stringify(cart));
    toast.success("Producto añadido al carrito");
    window.dispatchEvent(new Event("storage"));
  };

  const resetFilters = () => { setSelectedCategory("todos"); setAvailability("all"); setMaxPrice(500); setEnvironment("all"); setLight("all"); setPetSafe(false); setSort("relevance"); };

  return (
    <div className="min-h-screen">
      <div className="bg-muted/30 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12"><h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{site.productsPage.title}</h1><p className="text-muted-foreground max-w-2xl">{site.productsPage.subtitle}</p></div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input type="text" placeholder="Busca plantas, ocasiones, luz, tamaño…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full pl-11 pr-10 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></button>}
              {suggestions.length > 0 && searchQuery && <div className="absolute z-30 mt-2 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden">{suggestions.map((p) => <Link key={p.id} to={`/producto/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted"><img src={p.image} className="h-10 w-10 rounded-lg object-cover" alt="" /><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">€{Number(p.salePrice || p.price || 0).toFixed(2)}</p></div></Link>)}</div>}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-border bg-background px-4 py-3">
              <option value="relevance">Relevancia</option><option value="featured">Destacados</option><option value="newest">Novedades</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option><option value="stock">Disponibilidad</option>
            </select>
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-center gap-2 px-5 py-3 bg-background border border-border rounded-xl hover:bg-accent"><SlidersHorizontal className="w-5 h-5" />Filtros</button>
          </div>

          <div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={`px-4 py-2 rounded-lg transition-all ${selectedCategory === category.id ? "bg-primary text-primary-foreground" : "bg-background border border-border text-foreground hover:bg-accent"}`}>{category.name}</button>)}</div>

          {showFilters && <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm font-medium">Disponibilidad<select value={availability} onChange={(e) => setAvailability(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-2"><option value="all">Todos</option><option value="available">En stock</option><option value="out">Agotados</option></select></label>
            <label className="text-sm font-medium">Ubicación<select value={environment} onChange={(e) => setEnvironment(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-2"><option value="all">Todas</option><option value="interior">Interior</option><option value="exterior">Exterior</option></select></label>
            <label className="text-sm font-medium">Luz<select value={light} onChange={(e) => setLight(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-2"><option value="all">Cualquiera</option><option value="baja">Poca luz</option><option value="indirecta">Indirecta</option><option value="sol">Sol</option></select></label>
            <label className="text-sm font-medium">Precio máximo: €{maxPrice}<input type="range" min="5" max="500" step="5" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="mt-3 w-full" /></label>
            <div className="flex flex-col justify-between gap-2"><button type="button" onClick={() => setPetSafe(!petSafe)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${petSafe ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>🐾 Aptas para mascotas</button><button onClick={resetFilters} className="text-sm text-muted-foreground hover:text-foreground">Limpiar filtros</button></div>
          </div>}

          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{filteredProducts.length} productos</span><span>{favorites.length} favoritos</span></div>
        </div>

        {filteredProducts.length === 0 ? <div className="text-center py-20"><Filter className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-muted-foreground text-lg">{site.productsPage.emptyText}</p><button onClick={resetFilters} className="mt-4 text-primary font-semibold">Quitar filtros</button></div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => {
              const stock = Math.max(0, Math.floor(Number(product.stock || 0)));
              const favorite = favorites.includes(String(product.id));
              return <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.03, .3) }} className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all">
                <Link to={`/producto/${product.id}`} className="relative h-64 overflow-hidden bg-muted block">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  {product.featured && <div className="absolute top-3 right-3 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">{site.productsPage.featuredLabel}</div>}
                  <button onClick={(event) => { event.preventDefault(); void toggleFavorite(product.id); }} className={`absolute top-3 left-3 p-2 backdrop-blur-sm rounded-full transition-colors ${favorite ? "bg-primary text-primary-foreground" : "bg-background/85 text-foreground"}`}><Heart className={`w-5 h-5 ${favorite ? "fill-current" : ""}`} /></button>
                </Link>
                <div className="p-5">
                  <Link to={`/producto/${product.id}`}><h3 className="font-semibold text-foreground mb-2 line-clamp-1 hover:text-primary">{product.name}</h3></Link>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{product.description}</p>
                  <div className="mb-3 flex flex-wrap gap-1.5">{product.light && <span className="rounded-full bg-muted px-2 py-1 text-[11px]">{product.light}</span>}{product.environment && <span className="rounded-full bg-muted px-2 py-1 text-[11px]">{product.environment}</span>}{product.petSafe && <span className="rounded-full bg-muted px-2 py-1 text-[11px]">🐾 Pet friendly</span>}</div>
                  <div className="flex items-center justify-between gap-3"><div>{product.onSale && product.salePrice ? <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground line-through">€{Number(product.price || 0).toFixed(2)}</span><span className="text-xl font-bold text-primary">€{Number(product.salePrice || 0).toFixed(2)}</span></div> : <span className="text-xl font-bold text-primary">€{Number(product.price || 0).toFixed(2)}</span>}</div><button disabled={stock <= 0} onClick={() => addToCart(product.id)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"><ShoppingCart className="w-4 h-4" />{stock <= 0 ? site.productsPage.outOfStockText : site.productsPage.addButtonLabel}</button></div>
                </div>
              </motion.div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
