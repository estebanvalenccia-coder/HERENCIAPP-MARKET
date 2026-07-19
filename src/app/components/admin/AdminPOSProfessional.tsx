import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { CreditCard, PackageCheck, Printer, Receipt, Search, ShieldCheck, ShoppingCart, Trash2, UserRound, Wallet, Plus, Minus, Clock, DollarSign, TrendingUp, AlertCircle, CheckCircle, X, Settings, BarChart3, User, Mail, Phone, MapPin, FileText, Download, Copy, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

type PosItem = { id: string; name: string; sku: string; price: number; iva: number; stock: number; category: string; emoji: string };
type CartLine = PosItem & { qty: number; discount?: number };
type Customer = { id: string; name: string; nif: string; email: string; address: string };

const demoProducts: PosItem[] = [
  { id: "p1", name: "Ramo temporada premium", sku: "RAM-001", price: 45, iva: 21, stock: 12, category: "Ramos", emoji: "💐" },
  { id: "p2", name: "Rosa roja unidad", sku: "FLO-101", price: 4.5, iva: 10, stock: 80, category: "Flor cortada", emoji: "🌹" },
  { id: "p3", name: "Monstera Deliciosa", sku: "PLA-210", price: 39.95, iva: 21, stock: 6, category: "Plantas", emoji: "🪴" },
  { id: "p4", name: "Orquídea Phalaenopsis", sku: "PLA-211", price: 29.95, iva: 21, stock: 9, category: "Plantas", emoji: "🌸" },
  { id: "p5", name: "Maceta cerámica blanca", sku: "MAC-030", price: 12.5, iva: 21, stock: 18, category: "Macetas", emoji: "🏺" },
  { id: "p6", name: "Sustrato universal 10L", sku: "SUB-010", price: 6.95, iva: 21, stock: 30, category: "Sustratos", emoji: "🌱" },
  { id: "p7", name: "Fertilizante universal", sku: "FER-100", price: 9.9, iva: 21, stock: 22, category: "Fertilizantes", emoji: "🧴" },
  { id: "p8", name: "Tarjeta dedicatoria", sku: "ACC-001", price: 2.5, iva: 21, stock: 100, category: "Accesorios", emoji: "💌" },
  { id: "p9", name: "Rosa blanca unidad", sku: "FLO-102", price: 3.5, iva: 10, stock: 120, category: "Flor cortada", emoji: "🤍" },
  { id: "p10", name: "Tulipán rojo", sku: "FLO-103", price: 2.8, iva: 10, stock: 150, category: "Flor cortada", emoji: "🌷" },
  { id: "p11", name: "Clavel surtido", sku: "FLO-104", price: 2.0, iva: 10, stock: 200, category: "Flor cortada", emoji: "🌺" },
  { id: "p12", name: "Planta suculenta pequeña", sku: "PLA-001", price: 8.5, iva: 21, stock: 40, category: "Plantas", emoji: "🌵" },
];

const categories = ["Todos", ...new Set(demoProducts.map(p => p.category))];
const demoCustomers: Customer[] = [
  { id: "c1", name: "Cliente mostrador", nif: "", email: "", address: "" },
  { id: "c2", name: "María García", nif: "12345678A", email: "maria@email.com", address: "Barcelona" },
  { id: "c3", name: "Empresa Jardines BCN", nif: "B12345678", email: "facturas@jardinesbcn.es", address: "Barcelona" },
];

function money(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
}

export function AdminPOSProfessional() {
  const stripePublishable = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
  const apiBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
  const stripePromise = stripePublishable ? loadStripe(stripePublishable) : null;
  
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer>(demoCustomers[0]);
  const [payment, setPayment] = useState("Efectivo");
  const [received, setReceived] = useState(0);
  const [keypadValue, setKeypadValue] = useState("");
  const [documentType, setDocumentType] = useState<"ticket" | "invoice">("ticket");
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("HF-2026-000128");
  const [showCardModal, setShowCardModal] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountLineId, setDiscountLineId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  const keypadAmount = useMemo(() => {
    if (!keypadValue || keypadValue === ".") return 0;
    const value = parseFloat(keypadValue);
    return Number.isFinite(value) ? value : 0;
  }, [keypadValue]);
  const effectiveReceived = keypadValue !== "" ? keypadAmount : received;

  const products = useMemo(() => {
    let filtered = demoProducts;
    if (selectedCategory !== "Todos") {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    const q = query.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter((p) => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q));
    }
    return filtered;
  }, [query, selectedCategory]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => {
      const lineSubtotal = (l.price / (1 + l.iva / 100)) * l.qty;
      const discount = l.discount ? (lineSubtotal * l.discount) / 100 : 0;
      return s + (lineSubtotal - discount);
    }, 0);
    const iva = cart.reduce((s, l) => {
      const lineSubtotal = (l.price / (1 + l.iva / 100)) * l.qty;
      const discount = l.discount ? (lineSubtotal * l.discount) / 100 : 0;
      const lineIva = ((lineSubtotal - discount) * l.iva) / 100;
      return s + lineIva;
    }, 0);
    const total = subtotal + iva;
    return { subtotal, iva, total, change: Math.max(0, Number(effectiveReceived || 0) - total) };
  }, [cart, effectiveReceived]);

  function addItem(item: PosItem) {
    setCart((current) => {
      const found = current.find((line) => line.id === item.id);
      if (found) return current.map((line) => (line.id === item.id ? { ...line, qty: line.qty + 1 } : line));
      return [...current, { ...item, qty: 1 }];
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((current) => current.map((line) => (line.id === id ? { ...line, qty: Math.max(1, line.qty + delta) } : line)));
  }

  function removeLine(id: string) {
    setCart((current) => current.filter((line) => line.id !== id));
  }

  function applyDiscount() {
    if (discountLineId && discountPercent > 0 && discountPercent <= 100) {
      setCart((current) => current.map((line) => (line.id === discountLineId ? { ...line, discount: discountPercent } : line)));
      setShowDiscountModal(false);
      setDiscountPercent(0);
      setDiscountLineId(null);
      toast.success("Descuento aplicado");
    }
  }

  function clearSale() {
    setCart([]);
    setNotes("");
    setReceived(0);
    setKeypadValue("");
    setCustomer(demoCustomers[0]);
    setDocumentType("ticket");
  }

  function completeSale() {
    if (!cart.length) {
      toast.error("Añade artículos antes de cobrar");
      return;
    }

    const finalReceived = effectiveReceived;
    if (payment === "Efectivo" && totals.total > 0 && finalReceived < totals.total) {
      toast.error("El efectivo recibido debe ser mayor o igual al total");
      return;
    }

    if (payment === "Tarjeta") {
      if (!stripePublishable) {
        toast.error("VITE_STRIPE_PUBLISHABLE_KEY no está configurada.");
        return;
      }

      if (!stripePromise) {
        toast.error("No se puede inicializar Stripe.");
        return;
      }

      setProcessingPayment(true);
      fetch(`${apiBase}/api/stripe/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totals.total,
          currency: "eur",
          items: cart,
          customerEmail: customer.email,
          customerName: customer.name,
          deliveryMethod: "mostrador",
          shipping: 0,
          subtotal: totals.subtotal,
          paymentMethod: "tarjeta",
          metadata: { notes, invoiceNumber, documentType },
        }),
      })
        .then(async (r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setClientSecret(data.clientSecret || null);
          setShowCardModal(true);
        })
        .catch((err) => {
          console.error("Error:", err);
          toast.error("Error al procesar el pago: " + (err.message || err));
        })
        .finally(() => setProcessingPayment(false));

      return;
    }

    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            customerName: customer.name,
            customerEmail: customer.email || null,
            items: cart,
            subtotal: totals.subtotal,
            shipping: 0,
            total: totals.total,
            received: finalReceived,
            paymentMethod: payment === "Efectivo" ? "manual" : payment.toLowerCase(),
            metadata: { notes, invoiceNumber, documentType },
          }),
        });

        const body = await res.json();

        if (!res.ok) {
          throw new Error(body.error || "Error creando pedido");
        }

        toast.success(documentType === "invoice" ? "Factura guardada" : "Ticket guardado");
      } catch (err: any) {
        const sale = {
          id: crypto.randomUUID(),
          invoiceNumber,
          documentType,
          customer,
          payment,
          items: cart,
          subtotal: totals.subtotal,
          iva: totals.iva,
          total: totals.total,
          notes,
          createdAt: new Date().toISOString(),
        };

        const stored = JSON.parse(localStorage.getItem("herencia_pos_sales") || "[]");
        localStorage.setItem("herencia_pos_sales", JSON.stringify([sale, ...stored]));

        toast.success(documentType === "invoice" ? "Factura guardada localmente" : "Ticket guardado localmente");
      } finally {
        setInvoiceNumber((prev) => prev.replace(/(\d+)$/, (n) => String(Number(n) + 1).padStart(n.length, "0")));
        clearSale();
      }
    })();
  }

  function printTicket() {
    if (!cart.length) {
      toast.error("No hay nada para imprimir");
      return;
    }
    window.print();
  }

  const quickKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0", "."];

  function handleKeypadPress(key: string) {
    setKeypadValue((current) => {
      if (key === "00") {
        return current + "00";
      } else if (key === ".") {
        if (current === "") return "0.";
        if (current.includes(".")) return current;
        return current + ".";
      } else {
        if (current === "" && key !== "0") return key;
        if (current === "0" && key !== ".") return key;
        return current + key;
      }
    });
  }

  function commitKeypadValue() {
    if (keypadValue && keypadValue !== "." && keypadAmount > 0) {
      setReceived((current) => current + keypadAmount);
    }
    setKeypadValue("");
  }

  function CardPaymentForm({ clientSecret, onSuccess, onCancel }: { clientSecret: string; onSuccess: () => void; onCancel: () => void; }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: any) {
      e.preventDefault();
      if (!stripe || !elements) return;
      setLoading(true);

      const card = elements.getElement(CardElement);
      if (!card) {
        toast.error("Formulario de tarjeta no disponible");
        setLoading(false);
        return;
      }

      const res = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: customer.name || undefined,
            email: customer.email || undefined,
          },
        },
      });

      if (res.error) {
        toast.error("Pago fallido: " + res.error.message);
        setLoading(false);
        return;
      }

      if (res.paymentIntent && res.paymentIntent.status === "succeeded") {
        toast.success("¡Pago procesado correctamente!");
        onSuccess();
      } else {
        toast.error("El pago no se completó correctamente");
      }

      setLoading(false);
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border p-4 bg-white">
          <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2">Cancelar</button>
          <button type="submit" disabled={loading} className="rounded-xl bg-emerald-600 px-4 py-2 text-white">{loading ? 'Procesando...' : 'Confirmar pago'}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white print:bg-white print:text-black">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/95 backdrop-blur-xl sticky top-0 z-40 print:hidden">
        <div className="max-w-[2000px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🌿</div>
            <div>
              <h1 className="text-2xl font-black">HERENCIA TPV</h1>
              <p className="text-xs text-slate-400">Caja 01 · Sistema profesional de punto de venta</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowStats(!showStats)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition">
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-bold">Estadísticas</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[2000px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-6 print:grid-cols-1">
        {/* Main Section */}
        <main className="space-y-6">
          {/* Search & Categories */}
          <div className="space-y-4 print:hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto, SKU..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence>
              {products.map((product) => (
                <motion.button
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  whileHover={{ y: -4 }}
                  onClick={() => addItem(product)}
                  className="p-4 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 hover:border-emerald-500 transition text-left group"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                    {product.emoji}
                  </div>
                  <p className="text-xs text-slate-400 font-bold uppercase">{product.category}</p>
                  <h3 className="font-black text-sm mt-1 line-clamp-2">{product.name}</h3>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-black text-emerald-400">{money(product.price)}</span>
                    <span className="text-xs bg-slate-600 px-2 py-1 rounded">Stock {product.stock}</span>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </main>

        {/* Sidebar - Cart & Payment */}
        <aside className="space-y-6">
          {/* Cart */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 print:border-2 print:border-black">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
              <div>
                <h2 className="text-xl font-black">{documentType === "invoice" ? "FACTURA" : "TICKET"}</h2>
                <p className="text-xs text-slate-400 font-bold">{invoiceNumber}</p>
              </div>
              <ShoppingCart className="w-6 h-6 text-emerald-400" />
            </div>

            {/* Customer */}
            <div className="mb-4 print:hidden">
              <label className="text-xs font-bold text-slate-400 mb-2 block">CLIENTE</label>
              <select
                value={customer.id}
                onChange={(e) => setCustomer(demoCustomers.find((c) => c.id === e.target.value) || demoCustomers[0])}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-sm font-bold"
              >
                {demoCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.nif ? `· ${c.nif}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items */}
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Sin artículos
                </div>
              ) : (
                cart.map((line) => (
                  <div key={line.id} className="bg-slate-700/50 p-3 rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm">{line.emoji} {line.name}</p>
                        <p className="text-xs text-slate-400">{line.sku} · IVA {line.iva}%</p>
                      </div>
                      <button onClick={() => removeLine(line.id)} className="text-rose-400 hover:text-rose-300 print:hidden">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 print:hidden">
                        <button onClick={() => changeQty(line.id, -1)} className="px-2 py-1 bg-slate-600 rounded text-xs font-bold">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold w-8 text-center">{line.qty}</span>
                        <button onClick={() => changeQty(line.id, 1)} className="px-2 py-1 bg-slate-600 rounded text-xs font-bold">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="font-black text-emerald-400 text-sm">{money(line.price * line.qty)}</p>
                    </div>
                    {line.discount && (
                      <div className="text-xs text-amber-400 font-bold">Descuento: -{line.discount}%</div>
                    )}
                    {!showDiscountModal && (
                      <button
                        onClick={() => {
                          setDiscountLineId(line.id);
                          setDiscountPercent(0);
                          setShowDiscountModal(true);
                        }}
                        className="w-full text-xs font-bold text-slate-300 hover:text-slate-200 py-1 print:hidden"
                      >
                        Aplicar descuento
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="space-y-2 border-t border-slate-700 pt-4 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Base imponible</span>
                <span className="font-bold">{money(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">IVA</span>
                <span className="font-bold">{money(totals.iva)}</span>
              </div>
              <div className="flex justify-between text-lg font-black text-emerald-400 border-t border-slate-700 pt-2">
                <span>TOTAL</span>
                <span>{money(totals.total)}</span>
              </div>
            </div>

            {/* Notes */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas..."
              className="w-full text-xs p-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 resize-none h-16 print:hidden"
            />
          </div>

          {/* Keypad */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-4 print:hidden space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">Origen TPV: AdminPOSProfessional</p>
            <div className="bg-slate-900 rounded-lg p-4 text-right">
              <p className="text-xs text-slate-400 mb-1">Efectivo recibido</p>
              <p className="text-3xl font-black text-emerald-400">{money(effectiveReceived)}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {quickKeys.map((k) => (
                <button
                  key={k}
                  onClick={() => handleKeypadPress(k)}
                  className="py-3 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-sm transition"
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setKeypadValue("")} className="col-span-1 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 font-bold text-sm transition">
                Borrar
              </button>
              <button onClick={commitKeypadValue} className="col-span-1 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-sm transition">
                +
              </button>
              <button onClick={commitKeypadValue} className="col-span-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-sm transition">
                OK
              </button>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-4 print:hidden space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {["Efectivo", "Tarjeta", "Bizum", "Transferencia"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPayment(p)}
                  className={`py-3 px-2 rounded-lg font-bold text-sm transition ${
                    payment === p
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm font-bold">
              <div className="bg-slate-700/50 p-3 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Cambio</p>
                <p className="text-emerald-400 text-lg">{money(totals.change)}</p>
              </div>
              <div className="bg-slate-700/50 p-3 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Articulos</p>
                <p className="text-emerald-400 text-lg">{cart.length}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 print:hidden">
            <button
              onClick={printTicket}
              className="py-4 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold flex items-center justify-center gap-2 transition"
            >
              <Printer className="w-5 h-5" />
              <span className="text-sm">Imprimir</span>
            </button>
            <button
              onClick={completeSale}
              disabled={cart.length === 0}
              className="py-4 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-sm">Cobrar</span>
            </button>
          </div>

          {/* Document Type Toggle */}
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => setDocumentType("ticket")}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${
                documentType === "ticket"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              Ticket
            </button>
            <button
              onClick={() => setDocumentType("invoice")}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${
                documentType === "invoice"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              Factura
            </button>
          </div>
        </aside>
      </div>

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-xl font-black">Aplicar descuento</h3>
            <input
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              placeholder="Porcentaje (%)"
              className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white font-bold"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowDiscountModal(false)} className="flex-1 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold">
                Cancelar
              </button>
              <button onClick={applyDiscount} className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold">
                Aplicar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Stripe Card Modal */}
      {showCardModal && clientSecret && stripePromise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-xl font-black">Pagar con tarjeta</h3>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CardPaymentForm
                clientSecret={clientSecret}
                onSuccess={() => {
                  setShowCardModal(false);
                  setClientSecret(null);
                  setInvoiceNumber((prev) => prev.replace(/(\d+)$/, (n) => String(Number(n) + 1).padStart(n.length, "0")));
                  clearSale();
                }}
                onCancel={() => {
                  setShowCardModal(false);
                  setClientSecret(null);
                }}
              />
            </Elements>
          </motion.div>
        </div>
      )}
    </div>
  );
}
