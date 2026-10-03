import { useEffect, useMemo, useState } from "react";
import { Filter, Heart, Search, ShoppingCart, SlidersHorizontal, X } from "lucide-react";
import { motion } from "motion/react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, parseSiteContent, type SiteContent } from "../lib/siteContent";
import {
  COMMERCE_COLLECTIONS,
  getCommerceCollection,
  isPlantLikeCollection,
  primaryCollectionOf,
  productBelongsToCollection,
} from "../lib/commerceCatalog";

const normalize = (value: unknown) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function fuzzyMatch(haystack: string, query: string) {
  const text = normalize(haystack);
  const q = normalize(query);
  if (!q) return true;
  if (text.includes(q)) return true;
  return q.split(/\s+/).every((token) =>
    token.length < 3
      ? text.includes(token)
      : text.split(/\s+/).some((word) => word.includes(token) || token.includes(word))
  );
}

function effectivePrice(product: any) {
  return Number(product?.onSale && product?.salePrice ? product.salePrice : product?.price || 0);
}

export function Products() {
  const location = useLocation();
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [displayProducts, setDisplayProducts] = useState<any[]>([]);
  const [collectionOptions, setCollectionOptions] = useState<any[]>(
    COMMERCE_COLLECTIONS.map((item) => ({ id: item.id, name: item.name, status: "active" }))
  );
  const [selectedCollection, setSelectedCollection] = useState("todos");
  const [selectedCategory, setSelectedCategory] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [availability, setAvailability] = useState("all");
  const [maxPrice, setMaxPrice] = useState(500);
  const [environment, setEnvironment] = useState("all");
  const [light, setLight] = useState("all");
  const [petSafe, setPetSafe] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  const gridClass =
    Number(site.productsPage.columns || 4) <= 2
      ? "grid-cols-1 sm:grid-cols-2"
      : Number(site.productsPage.columns || 4) === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : Number(site.productsPage.columns || 4) >= 5
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  const imageClass =
    site.productsPage.imageAspect === "portrait"
      ? "h-80"
      : site.productsPage.imageAspect === "landscape"
        ? "h-52"
        : "h-64";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const collection = params.get("coleccion") || params.get("collection");
    const category = params.get("categoria");
    const search = params.get("buscar");
    if (collection) setSelectedCollection(collection);
    if (category) setSelectedCategory(category);
    if (search !== null) setSearchQuery(search);
  }, [location.search]);

  useEffect(() => {
    if (site.productsPage.defaultSort) setSort(site.productsPage.defaultSort);
  }, [site.productsPage.defaultSort]);

  useEffect(() => {
    let cancelled = false;

    const hydrateLocal = () => {
      setSite(parseSiteContent(backendStorage.getItem("siteContent")));
      try {
        setFavorites(JSON.parse(backendStorage.getItem("wishlist") || "[]").map(String));
      } catch {
        setFavorites([]);
      }
    };

    async function loadCatalog() {
      try {
        const [productResult, collectionResult] = await Promise.all([
          backendApi.listCommerceProducts(),
          backendApi.listCommerceCollections(),
        ]);
        if (cancelled) return;

        const rows = Array.isArray(productResult.products)
          ? productResult.products.filter((product: any) => product.status === "active" || product.active === true)
          : [];
        const collections = Array.isArray(collectionResult.collections)
          ? collectionResult.collections.filter((item: any) => String(item.status || "active") === "active")
          : [];

        setDisplayProducts(rows);
        if (collections.length) setCollectionOptions(collections);
        if (rows.length) backendStorage.setCachedItem("adminProducts", JSON.stringify(rows));
      } catch {
        if (cancelled) return;
        try {
          const cached = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
          const active = Array.isArray(cached)
            ? cached.filter((product: any) => product.status === "active" || product.active !== false)
            : [];
          setDisplayProducts(active);
        } catch {
          setDisplayProducts([]);
        }
      }
    }

    hydrateLocal();
    void loadCatalog();

    backendApi.customerWishlist().then((result) => {
      if (cancelled) return;
      const ids = (result.wishlist || []).map(String);
      setFavorites(ids);
      backendStorage.setCachedItem("wishlist", JSON.stringify(ids));
    }).catch(() => {});

    const refreshLocal = () => hydrateLocal();
    const refreshCatalog = () => void loadCatalog();
    window.addEventListener("storage", refreshLocal);
    window.addEventListener("backend-storage", refreshLocal);
    window.addEventListener("commerce-products-changed", refreshCatalog);
    window.addEventListener("commerce-collections-changed", refreshCatalog);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", refreshLocal);
      window.removeEventListener("backend-storage", refreshLocal);
      window.removeEventListener("commerce-products-changed", refreshCatalog);
      window.removeEventListener("commerce-collections-changed", refreshCatalog);
    };
  }, []);

  const selectedBaseDefinition =
    selectedCollection === "todos"
      ? null
      : COMMERCE_COLLECTIONS.find((item) => item.id === selectedCollection) || null;
  const selectedDynamicCollection =
    selectedCollection === "todos"
      ? null
      : collectionOptions.find((item) => String(item.id) === selectedCollection) || null;
  const selectedDefinition = selectedBaseDefinition || selectedDynamicCollection;
  const categoryOptions = selectedBaseDefinition?.categories || [];
  const plantFilters = selectedBaseDefinition ? isPlantLikeCollection(selectedBaseDefinition.id) : false;

  useEffect(() => {
    if (selectedCollection === "todos") {
      setSelectedCategory("todos");
      setEnvironment("all");
      setLight("all");
      setPetSafe(false);
      return;
    }
    const valid = categoryOptions.some((item) => item.id === selectedCategory);
    if (!valid) setSelectedCategory("todos");
    if (!plantFilters) {
      setEnvironment("all");
      setLight("all");
      setPetSafe(false);
    }
  }, [selectedCollection]);

  const catalogMax = useMemo(() => {
    const highest = Math.max(0, ...displayProducts.map((product) => effectivePrice(product)));
    return Math.max(100, Math.ceil(highest / 50) * 50 || 500);
  }, [displayProducts]);

  useEffect(() => {
    if (maxPrice < catalogMax) return;
    setMaxPrice(catalogMax);
  }, [catalogMax]);

  const suggestions = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    return displayProducts
      .filter((product) =>
        fuzzyMatch(
          [product.name, product.description, product.category, ...(Array.isArray(product.tags) ? product.tags : [product.tags])]
            .filter(Boolean)
            .join(" "),
          searchQuery
        )
      )
      .slice(0, 6);
  }, [displayProducts, searchQuery]);

  const filteredProducts = useMemo(() => {
    const rows = displayProducts.filter((product) => {
      const collectionMatch = productBelongsToCollection(product, selectedCollection);
      const categoryMatch =
        selectedCategory === "todos" || String(product.category || "") === selectedCategory;
      const searchText = [
        product.name,
        product.description,
        product.category,
        primaryCollectionOf(product),
        ...(Array.isArray(product.tags) ? product.tags : [product.tags]),
        product.occasion,
        product.light,
        product.environment,
        product.size,
      ]
        .filter(Boolean)
        .join(" ");
      const searchMatch = fuzzyMatch(searchText, searchQuery);

      const tracked = product.trackInventory !== false;
      const stock = Math.max(0, Math.floor(Number(product.stock || 0)));
      const availabilityMatch =
        availability === "all" ||
        !tracked ||
        (availability === "available" ? stock > 0 : stock <= 0);
      const priceMatch = effectivePrice(product) <= maxPrice;

      const env = normalize(product.environment || product.location || "");
      const environmentMatch = environment === "all" || env.includes(environment);
      const lightText = normalize(product.light || product.care?.light || "");
      const lightMatch = light === "all" || lightText.includes(light);
      const safe =
        product.petSafe === true ||
        normalize(product.toxicity).includes("no tox") ||
        normalize(product.toxicity).includes("segur");

      return (
        collectionMatch &&
        categoryMatch &&
        searchMatch &&
        availabilityMatch &&
        priceMatch &&
        environmentMatch &&
        lightMatch &&
        (!petSafe || safe)
      );
    });

    return [...rows].sort((a, b) => {
      const ap = effectivePrice(a);
      const bp = effectivePrice(b);
      if (sort === "price-asc") return ap - bp;
      if (sort === "price-desc") return bp - ap;
      if (sort === "stock") return Number(b.stock || 0) - Number(a.stock || 0);
      if (sort === "featured") return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (sort === "newest") return String(b.id).localeCompare(String(a.id));
      return 0;
    });
  }, [
    displayProducts,
    selectedCollection,
    selectedCategory,
    searchQuery,
    availability,
    maxPrice,
    environment,
    light,
    petSafe,
    sort,
  ]);

  async function toggleFavorite(productId: any) {
    const id = String(productId);
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    setFavorites(next);
    await backendStorage.setItem("wishlist", JSON.stringify(next));
    backendApi.customerSaveWishlist(next).catch(() => null);
    toast.success(next.includes(id) ? "Añadido a favoritos" : "Eliminado de favoritos");
  }

  function addToCart(productId: any) {
    const product = displayProducts.find((item) => String(item.id) === String(productId));
    if (!product) return toast.error("Artículo no encontrado");

    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const variant = variants.length
      ? variants.find((item: any) => product.trackInventory === false || Number(item?.stock || 0) > 0) || null
      : null;
    if (variants.length && !variant) return toast.error(site.productsPage.outOfStockText);

    const price = Number(variant?.price ?? effectivePrice(product));
    if (!price || price <= 0) return toast.error("Este artículo no tiene un precio válido");

    const tracked = product.trackInventory !== false;
    const stock = tracked
      ? Math.max(0, Math.floor(Number(variant?.stock ?? product.stock ?? 0)))
      : Number.POSITIVE_INFINITY;
    const selectedVariant = variant ? String(variant?.name || variant) : "";
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    const lineKey = `${product.id}::${selectedVariant || "base"}::`;
    const existing = cart.find((item: any) => item.lineKey === lineKey);
    const nextQuantity = Number(existing?.quantity || 0) + 1;

    if (tracked && stock <= 0) return toast.error(site.productsPage.outOfStockText);
    if (tracked && nextQuantity > stock) return toast.error(`Solo quedan ${stock} unidades disponibles`);

    if (existing) existing.quantity = nextQuantity;
    else cart.push({ ...product, price, quantity: 1, lineKey, selectedVariant: selectedVariant || undefined });

    void backendStorage.setItem("cart", JSON.stringify(cart));
    toast.success(primaryCollectionOf(product) === "servicios" ? "Servicio añadido" : "Producto añadido al carrito");
    window.dispatchEvent(new Event("storage"));
  }

  function resetFilters() {
    setSelectedCollection("todos");
    setSelectedCategory("todos");
    setAvailability("all");
    setMaxPrice(catalogMax);
    setEnvironment("all");
    setLight("all");
    setPetSafe(false);
    setSort("relevance");
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-[#718076]">HERENCIA MARKET</p>
          <h1 className="mb-3 text-4xl font-medium text-[#173126] md:text-5xl">{site.productsPage.title}</h1>
          <p className="max-w-2xl leading-7 text-[#66736b]">{site.productsPage.subtitle}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Busca plantas, moda, dulce, servicios, decoración…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {suggestions.length > 0 && searchQuery && (
                <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  {suggestions.map((product) => (
                    <Link key={String(product.id)} to={`/producto/${product.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                      <div className="h-10 w-10 overflow-hidden rounded-lg bg-muted">
                        {product.image && <img src={product.image} className="h-full w-full object-cover" alt="" />}
                      </div>
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">€{effectivePrice(product).toFixed(2)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-2xl border border-[#ded9cd] bg-[#fffdf9] px-4 py-3">
              <option value="relevance">Relevancia</option>
              <option value="featured">Destacados</option>
              <option value="newest">Novedades</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="stock">Disponibilidad</option>
            </select>

            {site.productsPage.showFilters !== false && (
              <button onClick={() => setShowFilters((value) => !value)} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 hover:bg-accent">
                <SlidersHorizontal className="h-5 w-5" /> {site.productsPage.filtersLabel || "Filtros"}
              </button>
            )}
          </div>

          {site.productsPage.showCollectionTabs !== false && (
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Colecciones</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedCollection("todos")} className={`rounded-full px-4 py-2 text-sm font-bold ${selectedCollection === "todos" ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>Todo</button>
                {collectionOptions
                  .filter((item) => String(item.status || "active") === "active")
                  .map((item) => {
                    const id = String(item.id);
                    return (
                      <button key={id} onClick={() => setSelectedCollection(id)} className={`rounded-full px-4 py-2 text-sm font-bold ${selectedCollection === id ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>
                        {String(item.name || id)}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {selectedBaseDefinition && site.productsPage.showSubcategories !== false && (
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Subcategorías</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedCategory("todos")} className={`rounded-lg px-3 py-2 text-sm font-bold ${selectedCategory === "todos" ? "bg-[#e6eee8] text-[#173126]" : "border border-border"}`}>Todas</button>
                {categoryOptions.map((item) => (
                  <button key={item.id} onClick={() => setSelectedCategory(item.id)} className={`rounded-lg px-3 py-2 text-sm font-bold ${selectedCategory === item.id ? "bg-[#e6eee8] text-[#173126]" : "border border-border"}`}>
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showFilters && site.productsPage.showFilters !== false && (
            <div className={`grid gap-4 rounded-2xl border border-border bg-card p-5 ${plantFilters ? "md:grid-cols-2 lg:grid-cols-5" : "md:grid-cols-3"}`}>
              <label className="text-sm font-medium">
                Disponibilidad
                <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-2">
                  <option value="all">Todos</option>
                  <option value="available">Disponibles</option>
                  <option value="out">Agotados</option>
                </select>
              </label>

              <label className="text-sm font-medium">
                Precio máximo: €{maxPrice}
                <input type="range" min="0" max={catalogMax} step="5" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="mt-3 w-full" />
              </label>

              {plantFilters && (
                <>
                  <label className="text-sm font-medium">
                    Ubicación
                    <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-2">
                      <option value="all">Todas</option><option value="interior">Interior</option><option value="exterior">Exterior</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Luz
                    <select value={light} onChange={(e) => setLight(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-2">
                      <option value="all">Cualquiera</option><option value="baja">Poca luz</option><option value="indirecta">Indirecta</option><option value="sol">Sol</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => setPetSafe((value) => !value)} className={`self-end rounded-xl border px-3 py-2 text-sm font-semibold ${petSafe ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>🐾 Aptas para mascotas</button>
                </>
              )}

              <button onClick={resetFilters} className="self-end text-sm font-bold text-muted-foreground hover:text-foreground">Limpiar filtros</button>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{filteredProducts.length} artículos</span>
            {site.productsPage.showFavorites !== false && <span>{favorites.length} favoritos</span>}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center">
            <Filter className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">{site.productsPage.emptyText}</p>
            <button onClick={resetFilters} className="mt-4 font-semibold text-primary">Quitar filtros</button>
          </div>
        ) : (
          <div className={`grid gap-6 ${gridClass}`}>
            {filteredProducts.map((product, index) => {
              const collection = getCommerceCollection(primaryCollectionOf(product));
              const tracked = product.trackInventory !== false;
              const stock = Math.max(0, Math.floor(Number(product.stock || 0)));
              const available = !tracked || stock > 0;
              const favorite = favorites.includes(String(product.id));

              return (
                <motion.article
                  key={String(product.id)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="group overflow-hidden border border-border bg-card transition-all hover:shadow-lg"
                  style={{ borderRadius: `${Math.max(0, Math.min(40, Number(site.productsPage.cardRadius ?? 24)))}px` }}
                >
                  <Link to={`/producto/${product.id}`} className={`relative block overflow-hidden bg-muted ${imageClass}`}>
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin imagen</div>
                    )}
                    <span className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-[11px] font-black backdrop-blur">{collection.name}</span>
                    {product.featured && <div className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{site.productsPage.featuredLabel}</div>}
                    {site.productsPage.showFavorites !== false && (
                      <button onClick={(event) => { event.preventDefault(); void toggleFavorite(product.id); }} className={`absolute left-3 top-3 rounded-full p-2 backdrop-blur-sm ${favorite ? "bg-primary text-primary-foreground" : "bg-background/85 text-foreground"}`}>
                        <Heart className={`h-5 w-5 ${favorite ? "fill-current" : ""}`} />
                      </button>
                    )}
                  </Link>

                  <div className="p-5">
                    <Link to={`/producto/${product.id}`}><h3 className="mb-2 line-clamp-1 font-semibold hover:text-primary">{product.name}</h3></Link>
                    <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>

                    {isPlantLikeCollection(collection.id) && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {product.light && <span className="rounded-full bg-muted px-2 py-1 text-[11px]">{product.light}</span>}
                        {product.environment && <span className="rounded-full bg-muted px-2 py-1 text-[11px]">{product.environment}</span>}
                        {product.petSafe && <span className="rounded-full bg-muted px-2 py-1 text-[11px]">🐾 Pet friendly</span>}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        {product.onSale && product.salePrice ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground line-through">€{Number(product.price || 0).toFixed(2)}</span>
                            <span className="text-xl font-bold text-primary">€{Number(product.salePrice || 0).toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-xl font-bold text-primary">€{Number(product.price || 0).toFixed(2)}</span>
                        )}
                      </div>

                      <button
                        disabled={!available}
                        onClick={() => addToCart(product.id)}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {!available
                          ? site.productsPage.outOfStockText
                          : collection.id === "servicios"
                            ? "Contratar"
                            : site.productsPage.addButtonLabel}
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
