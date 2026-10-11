import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";

export function Favorites() {
  const [productIds, setProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { wishlist } = await backendApi.customerWishlist();
        const ids = (wishlist || []).map(String);
        setProductIds(ids);
        const details = await Promise.all(
          ids.map((id) => backendApi.getCommerceProduct(id).then((res) => res.product).catch(() => null))
        );
        setProducts(details.filter(Boolean));
      } catch (e: any) {
        toast.error(e?.message || "Error cargando favoritos");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const toggleFavorite = async (productId: string) => {
    let list: string[] = [];
    try { list = JSON.parse(backendStorage.getItem("wishlist") || "[]").map(String); } catch {}
    const next = list.includes(productId) ? list.filter((x) => x !== productId) : [...list, productId];
    await backendStorage.setItem("wishlist", JSON.stringify(next));
    backendApi.customerSaveWishlist(next).catch(() => null);
    toast.success(next.includes(productId) ? "Añadido a favoritos" : "Eliminado de favoritos");
    setProductIds(next);
    setProducts((prev) => next.includes(productId) ? prev : prev.filter((p) => String(p.id) !== productId));
  };

  const addToCart = (product: any) => {
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    cart.push({ ...product, quantity: 1, lineKey: `${product.id}::base` });
    void backendStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    toast.success("Producto añadido al carrito");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Cargando favoritos…</p></div>;
  if (!productIds.length) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">No tienes productos favoritos.</p></div>;

  return (
    <div className="mx-auto max-w-7xl p-5">
      <h1 className="mb-6 text-3xl font-bold">Mis Favoritos</h1>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <article key={product.id} className="overflow-hidden rounded-[1.7rem] border border-[#e3ded4] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="relative h-56 w-full overflow-hidden bg-muted">
              {product.image ? (
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">Sin imagen</div>
              )}
              <button onClick={() => toggleFavorite(String(product.id))} className="absolute top-2 right-2 rounded-full bg-white/80 p-1 hover:bg-white">
                <Heart className="h-5 w-5 text-primary" />
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold">{product.name}</h3>
              <p className="mt-2 text-primary font-bold">€{Number(product.price || product.salePrice || 0).toFixed(2)}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => addToCart(product)} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-white">
                  <ShoppingCart className="h-4 w-4" /> Añadir al carrito
                </button>
                <Link to={`/producto/${product.id}`} className="flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-primary">
                  Ver detalle
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
