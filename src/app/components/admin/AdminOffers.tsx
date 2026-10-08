import { useState, useEffect } from "react";
import { Tag, TrendingDown } from "lucide-react";
import { motion } from "motion/react";
import { backendStorage } from "../../lib/backendStorage";

export function AdminOffers() {
  const [products, setProducts] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState(10);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const load = () => {
      try { const data = JSON.parse(backendStorage.getItem("discountCodes") || "[]"); setCodes(Array.isArray(data) ? data : []); }
      catch { setCodes([]); }
    };
    load();
    window.addEventListener("backend-storage", load);
    return () => window.removeEventListener("backend-storage", load);
  }, []);
  const persistCodes = async (next: any[]) => {
    setSaving(true);
    try {
      const result = await backendStorage.setItem("discountCodes", JSON.stringify(next));
      if (!result.ok) throw new Error(result.error || "No se pudo guardar");
      setCodes(next);
    } catch (error) { alert(error instanceof Error ? error.message : "Error al guardar"); }
    finally { setSaving(false); }
  };
  const saveCode = async () => {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(normalized)) return alert("Código de 3 a 40 caracteres alfanuméricos.");
    if (![10,50,100].includes(percent)) return alert("Selecciona 10, 50 o 100 %.");
    if (!Number.isInteger(maxUses) || maxUses < 1) return alert("Límite de usos no válido.");
    const previous = codes.find((x) => String(x.code).toUpperCase() === normalized);
    await persistCodes([...codes.filter((x) => String(x.code).toUpperCase() !== normalized), { ...previous, code: normalized, type: "percent", value: percent, active: true, maxUses, expiresAt: expiresAt || null }]);
  };


  useEffect(() => {
    let mounted = true;

    const loadOffers = async (refreshBackend = true) => {
      if (refreshBackend) {
        await backendStorage.refresh().catch(() => null);
      }

      try {
        const saved = backendStorage.getItem("adminProducts");
        const all = JSON.parse(saved || "[]");
        if (mounted) {
          setProducts((Array.isArray(all) ? all : []).filter((p: any) => p.onSale === true));
        }
      } catch {
        if (mounted) setProducts([]);
      }
    };

    loadOffers(true);

    const syncOffers = () => loadOffers(false);
    window.addEventListener("backend-storage", syncOffers);
    window.addEventListener("storage", syncOffers);

    return () => {
      mounted = false;
      window.removeEventListener("backend-storage", syncOffers);
      window.removeEventListener("storage", syncOffers);
    };
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

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-xl font-bold">Códigos promocionales</h3>
        <p className="text-sm text-muted-foreground">Crea descuentos para tus clientes. La validación del pedido debe realizarse en el servidor.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>Código<input className="mt-1 w-full rounded-lg border p-2" value={code} onChange={(e) => setCode(e.target.value)} placeholder="HERENCIA100" /></label>
          <label>Descuento<select className="mt-1 w-full rounded-lg border p-2" value={percent} onChange={(e) => setPercent(Number(e.target.value))}><option value={10}>10 %</option><option value={50}>50 %</option><option value={100}>100 %</option></select></label>
          <label>Usos máximos<input type="number" min={1} className="mt-1 w-full rounded-lg border p-2" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} /></label>
          <label>Caducidad<input type="date" className="mt-1 w-full rounded-lg border p-2" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label>
        </div>
        <button disabled={saving} onClick={saveCode} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Guardar cupón</button>
        {codes.map((entry) => <div key={entry.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
          <span className="font-semibold">{entry.code} · {entry.value}{entry.type === "fixed" ? " €" : " %"}</span>
          <div className="flex gap-2">
            <button className="rounded-lg border px-3 py-1" disabled={saving} onClick={() => persistCodes(codes.map((x) => x.code === entry.code ? { ...x, active: x.active === false } : x))}>{entry.active === false ? "Activar" : "Desactivar"}</button>
            <button className="rounded-lg border px-3 py-1" disabled={saving} onClick={() => { setCode(entry.code); setPercent(Number(entry.value) || 10); setMaxUses(Number(entry.maxUses) || 1); setExpiresAt(entry.expiresAt || ""); }}>Editar</button>
            <button className="rounded-lg border px-3 py-1" disabled={saving} onClick={() => persistCodes(codes.filter((x) => x.code !== entry.code))}>Eliminar</button>
          </div>
        </div>)}
      </section>
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
