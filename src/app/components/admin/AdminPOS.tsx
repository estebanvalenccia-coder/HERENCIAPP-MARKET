import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { CreditCard, PackageCheck, Printer, Receipt, Search, ShieldCheck, ShoppingCart, Trash2, UserRound, Wallet, Plus, Minus, Eye, EyeOff, Clock, DollarSign, TrendingUp, AlertCircle, CheckCircle, Home, Settings, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type PosItem = { id: string; name: string; sku: string; price: number; iva: number; stock: number; category: string; emoji: string };
type CartLine = PosItem & { qty: number; discount?: number };
type Customer = { id: string; name: string; nif: string; email: string; address: string };
type PosPaymentMethod = "Efectivo" | "Tarjeta" | "Bizum" | "Transferencia";

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

const demoCustomers: Customer[] = [
  { id: "c1", name: "Cliente mostrador", nif: "", email: "", address: "" },
  { id: "c2", name: "María García", nif: "12345678A", email: "maria@email.com", address: "Barcelona" },
  { id: "c3", name: "Empresa Jardines BCN", nif: "B12345678", email: "facturas@jardinesbcn.es", address: "Barcelona" },
];

function money(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
}

function keypadDisplay(value: string, fallbackAmount: number) {
  if (value === "") return money(fallbackAmount);
  return `${value.replace(".", ",")} €`;
}

export function AdminPOS() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
  const stripePublishable = env.VITE_STRIPE_PUBLISHABLE_KEY || "";
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer>(demoCustomers[0]);
  const [payment, setPayment] = useState<PosPaymentMethod>("Efectivo");
  const [received, setReceived] = useState(0);
  const [keypadValue, setKeypadValue] = useState("");
  const keypadAmount = useMemo(() => {
    if (!keypadValue || keypadValue === ".") return 0;
    const value = parseFloat(keypadValue);
    return Number.isFinite(value) ? value : 0;
  }, [keypadValue]);

  // El efectivo final incluye lo acumulado y lo tecleado actualmente.
  const effectiveReceived = received + (keypadValue !== "" ? keypadAmount : 0);
  const [documentType, setDocumentType] = useState<"ticket" | "invoice">("ticket");
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("HF-2026-000128");
  const [showCardModal, setShowCardModal] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const products = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return demoProducts;
    return demoProducts.filter((p) => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q));
  }, [query]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + (l.price / (1 + l.iva / 100)) * l.qty, 0);
    const iva = cart.reduce((s, l) => s + (l.price - l.price / (1 + l.iva / 100)) * l.qty, 0);
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

  function clearSale() {
    setCart([]);
    setNotes("");
    setReceived(0);
    setKeypadValue("");
    setCustomer(demoCustomers[0]);
    setDocumentType("ticket");
  }

  function safeReadArray<T>(key: string): T[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function toOrderItems(lines: CartLine[]) {
    return lines.map((line) => ({
      id: line.id,
      name: line.name,
      sku: line.sku,
      price: line.price,
      iva: line.iva,
      quantity: line.qty,
      qty: line.qty,
      category: line.category,
    }));
  }

  function persistSaleLocally(orderPayload: {
    id: string;
    customerName: string;
    customerEmail: string | null;
    items: ReturnType<typeof toOrderItems>;
    subtotal: number;
    total: number;
    paymentMethod: string;
    metadata: Record<string, unknown>;
  }) {
    const now = new Date();
    const isoNow = now.toISOString();

    const posSale = {
      id: orderPayload.id,
      invoiceNumber,
      documentType,
      customer,
      payment,
      items: cart,
      subtotal: totals.subtotal,
      iva: totals.iva,
      total: totals.total,
      notes,
      verifactuStatus: "Pendiente: falta configurar certificado digital/API VeriFactu",
      financeStatus: "Preparado para contabilizar en ventas, caja, gastos y mermas",
      createdAt: isoNow,
    };

    const tpvEngineSale = {
      id: orderPayload.id,
      customer: customer.name || "Cliente mostrador",
      paymentMethod: payment,
      subtotal: totals.subtotal,
      iva: totals.iva,
      total: totals.total,
      createdAt: isoNow,
      items: cart.map((line) => ({
        id: line.id,
        name: line.name,
        qty: line.qty,
        price: line.price,
        iva: line.iva,
      })),
    };

    const financeSale = {
      id: `tpv-${orderPayload.id}`,
      sale_date: isoNow.slice(0, 10),
      time: now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      client: customer.name || "Cliente mostrador",
      product:
        cart.map((line) => `${line.name} x${line.qty}`).join(", ") ||
        "Venta TPV",
      category: "TPV Mostrador",
      payment_method: payment,
      amount: Number(totals.total || 0),
      cost: 0,
      status: "Cobrado",
      notes: notes || `Venta local ${invoiceNumber}`,
      created_at: isoNow,
    };

    const localPosSales = safeReadArray<any>("herencia_pos_sales");
    const localTpvSales = safeReadArray<any>("herencia_sales");
    const localFinanceSales = safeReadArray<any>("herencia_finance_sales");

    localStorage.setItem("herencia_pos_sales", JSON.stringify([posSale, ...localPosSales]));
    localStorage.setItem("herencia_sales", JSON.stringify([tpvEngineSale, ...localTpvSales]));
    localStorage.setItem("herencia_finance_sales", JSON.stringify([financeSale, ...localFinanceSales]));
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
    const orderPayload = {
      id: crypto.randomUUID(),
      customerName: customer.name,
      customerEmail: customer.email || null,
      items: toOrderItems(cart),
      subtotal: totals.subtotal,
      shipping: 0,
      total: totals.total,
      received: finalReceived,
      paymentMethod: payment === "Efectivo" ? "cash" : payment.toLowerCase(),
      deliveryMethod: "mostrador",
      status: payment === "Tarjeta" ? "payment_pending" : "paid",
      metadata: {
        notes,
        invoiceNumber,
        documentType,
        source: "TPV_ADMIN",
      },
    };

    if (payment === "Tarjeta") {
      const stripeLoader = ensureStripeLoaded();
      if (!stripeLoader) {
        return;
      }

      setProcessingPayment(true);
      backendApi
        .createPaymentIntent({
          amount: totals.total,
          currency: "eur",
          items: orderPayload.items,
          customerEmail: customer.email,
          customerName: customer.name,
          deliveryMethod: "mostrador",
          shipping: 0,
          subtotal: totals.subtotal,
          paymentMethod: "tarjeta",
          metadata: { notes, invoiceNumber, documentType, source: "TPV_ADMIN" },
        })
        .then((data) => {
          setClientSecret(data.clientSecret || null);
          setShowCardModal(true);
        })
        .catch((err: any) => {
          console.error("Error creando PaymentIntent:", err);
          toast.error("No se pudo iniciar el pago con tarjeta: " + (err.message || err));
        })
        .finally(() => setProcessingPayment(false));

      return;
    }

    // Otros métodos: guardar pedido en backend (o local si backend no disponible)
    (async () => {
      try {
        await backendApi.createOrder(orderPayload);

        toast.success(documentType === "invoice" ? "Factura guardada en backend" : "Ticket guardado en backend");
      } catch (err: any) {
        console.warn("Fallo guardando pedido en backend, guardando localmente:", err.message || err);
        persistSaleLocally(orderPayload);
        toast.success(documentType === "invoice" ? "Factura guardada localmente (sin backend)" : "Ticket guardado localmente (sin backend)");
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

  function closeCardModal() {
    setShowCardModal(false);
    setClientSecret(null);
  }

  function ensureStripeLoaded() {
    if (!stripePublishable) {
      toast.error("VITE_STRIPE_PUBLISHABLE_KEY no está configurada. Revisa tu .env y reinicia el frontend.");
      return null;
    }

    if (stripePromise) return stripePromise;

    const nextPromise = loadStripe(stripePublishable);
    setStripePromise(nextPromise);
    return nextPromise;
  }

  const quickKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0", "."];
  const paymentMethods: PosPaymentMethod[] = ["Efectivo", "Tarjeta", "Bizum", "Transferencia"];

  function handleKeypadPress(key: string) {
    setKeypadValue((current) => {
      if (key === "00") {
        if (current === "") return "0";
        if (current === "0") return current;

        if (current.includes(".")) {
          const decimals = current.split(".")[1]?.length ?? 0;
          if (decimals >= 2) return current;
          return current + "0".repeat(Math.min(2 - decimals, 2));
        }

        return current + "00";
      } else if (key === ".") {
        if (current === "") return "0.";
        if (current.includes(".")) return current;
        return current + ".";
      } else {
        if (current.includes(".")) {
          const decimals = current.split(".")[1]?.length ?? 0;
          if (decimals >= 2) return current;
        }

        // Para dígitos (0-9)
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

  // Payment form component for Stripe
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
        const paymentMetadata = (res.paymentIntent as any)?.metadata as Record<string, string> | undefined;

        // Confirm order on backend
        try {
          await backendApi.confirmStripeOrder({ orderId: paymentMetadata?.orderId || "", paymentIntentId: res.paymentIntent.id });
        } catch (err: any) {
          console.warn("Error confirmando pedido en backend:", err.message || err);
        }

        toast.success("Pago procesado correctamente");
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
    <div className="relative -m-4 min-h-screen overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-50 via-white to-rose-50 p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8 print:bg-white">
      <div className="pointer-events-none absolute -left-14 top-20 text-9xl opacity-10 print:hidden">🪴</div>
      <div className="pointer-events-none absolute right-5 bottom-20 text-9xl opacity-10 print:hidden">💐</div>

      <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr_430px]">
        <aside className="space-y-5 print:hidden">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/90 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-emerald-50 pb-5">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-2xl">🌿</div>
              <div>
                <h2 className="text-xl font-black text-emerald-950">TPV Herencia</h2>
                <p className="text-xs font-bold text-emerald-600">Caja 01 · Admin</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 text-sm font-bold text-zinc-700">
              <Status icon={PackageCheck} label="Stock real" value="Preparado" />
              <Status icon={Wallet} label="Finanzas" value="Preparado" />
              <Status icon={Receipt} label="Tickets / facturas" value="Activo" />
              <Status icon={ShieldCheck} label="VeriFactu" value="Conexión pendiente" />
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white/90 p-5 shadow-xl backdrop-blur-xl">
            <p className="mb-3 text-sm font-black uppercase tracking-wide text-zinc-500">Teclado numérico</p>
            <p className="-mt-1 mb-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Origen TPV: AdminPOS</p>
            <div className="mb-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-right text-3xl font-black">{keypadDisplay(keypadValue, received)}</div>
            <div className="mb-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-right text-sm font-bold text-zinc-500">Total a pagar: {money(totals.total)}</div>
            <div className="mb-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-right text-sm font-bold text-zinc-500">Cambio actual: {money(totals.change)}</div>
            <div className="grid grid-cols-3 gap-2">
              {quickKeys.map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => handleKeypadPress(k)}
                  className="rounded-2xl border border-zinc-100 bg-white py-4 text-xl font-black shadow-sm hover:bg-emerald-50"
                >
                  {k}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setKeypadValue("")}
                className="rounded-2xl bg-rose-100 py-4 font-black text-rose-600"
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={commitKeypadValue}
                className="rounded-2xl bg-emerald-100 py-4 font-black text-emerald-700"
              >
                +
              </button>
              <button
                type="button"
                onClick={commitKeypadValue}
                className="rounded-2xl bg-emerald-600 py-4 font-black text-white"
              >
                Enter
              </button>
            </div>
          </section>
        </aside>

        <main className="space-y-5 print:hidden">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">TPV + facturación + finanzas</div>
                <h1 className="text-4xl font-black tracking-tight text-zinc-950">Venta de artículos</h1>
                <p className="mt-2 text-zinc-500">Artículos, clientes, tickets, facturas, IVA, stock, gastos, mermas y conexión preparada para VeriFactu.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDocumentType("ticket")} className={`rounded-2xl px-5 py-3 font-black ${documentType === "ticket" ? "bg-emerald-600 text-white" : "bg-white border"}`}>Ticket</button>
                <button onClick={() => setDocumentType("invoice")} className={`rounded-2xl px-5 py-3 font-black ${documentType === "invoice" ? "bg-emerald-600 text-white" : "bg-white border"}`}>Factura</button>
              </div>
            </div>
            <div className="relative mt-6">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar artículo, código, SKU o descripción..." className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/40 py-4 pl-12 pr-4 font-semibold outline-none focus:border-emerald-400" />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {products.map((product) => (
              <motion.button key={product.id} whileHover={{ y: -4 }} onClick={() => addItem(product)} className="rounded-[1.7rem] border border-emerald-100 bg-white/90 p-5 text-left shadow-lg transition hover:border-emerald-300">
                <div className="mb-4 grid h-24 place-items-center rounded-3xl bg-gradient-to-br from-emerald-50 to-rose-50 text-5xl">{product.emoji}</div>
                <p className="text-xs font-black uppercase text-emerald-600">{product.category} · {product.sku}</p>
                <h3 className="mt-1 min-h-12 font-black text-zinc-900">{product.name}</h3>
                <div className="mt-4 flex items-center justify-between"><span className="text-xl font-black text-emerald-700">{money(product.price)}</span><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">Stock {product.stock}</span></div>
              </motion.button>
            ))}
          </section>
        </main>

        <aside className="space-y-5">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/95 p-6 shadow-2xl backdrop-blur-xl print:shadow-none">
            <div className="mb-5 flex items-center justify-between border-b border-emerald-50 pb-4">
              <div><h2 className="text-2xl font-black text-zinc-950">Venta actual</h2><p className="text-sm font-bold text-zinc-500">{invoiceNumber} · {documentType === "invoice" ? "Factura" : "Ticket"}</p></div>
              <ShoppingCart className="h-7 w-7 text-emerald-600" />
            </div>

            <label className="mb-4 block print:hidden">
              <span className="mb-2 flex items-center gap-2 text-sm font-black text-zinc-600"><UserRound className="h-4 w-4" /> Cliente</span>
              <select value={customer.id} onChange={(e) => setCustomer(demoCustomers.find((c) => c.id === e.target.value) || demoCustomers[0])} className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 font-bold outline-none">
                {demoCustomers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.nif ? `· ${c.nif}` : ""}</option>)}
              </select>
            </label>

            <div className="max-h-[330px] space-y-3 overflow-auto pr-1">
              {cart.map((line) => (
                <div key={line.id} className="rounded-3xl border border-zinc-100 bg-zinc-50/70 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-black text-zinc-900">{line.emoji} {line.name}</p><p className="text-xs font-bold text-zinc-500">IVA {line.iva}% · {line.sku}</p></div><button onClick={() => removeLine(line.id)} className="text-rose-500 print:hidden"><Trash2 className="h-4 w-4" /></button></div>
                  <div className="mt-3 flex items-center justify-between"><div className="flex items-center rounded-2xl bg-white print:hidden"><button onClick={() => changeQty(line.id, -1)} className="px-3 py-2 font-black">−</button><span className="px-3 font-black">{line.qty}</span><button onClick={() => changeQty(line.id, 1)} className="px-3 py-2 font-black">+</button></div><p className="text-lg font-black text-emerald-700">{money(line.price * line.qty)}</p></div>
                </div>
              ))}
              {!cart.length && <div className="rounded-3xl border border-dashed border-emerald-200 p-8 text-center text-zinc-400">Añade artículos para empezar la venta.</div>}
            </div>

            <div className="mt-5 space-y-3 border-t border-emerald-50 pt-5 text-sm">
              <TotalRow label="Base imponible" value={money(totals.subtotal)} />
              <TotalRow label="IVA incluido" value={money(totals.iva)} />
              <TotalRow label="Total" value={money(totals.total)} strong />
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas de venta, dedicatoria, entrega, merma relacionada..." className="mt-4 w-full rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm outline-none print:hidden" />
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white/95 p-6 shadow-xl backdrop-blur-xl print:hidden">
            <h3 className="mb-4 text-xl font-black text-zinc-950">Pago y emisión</h3>
            <div className="grid grid-cols-2 gap-3">
              {paymentMethods.map((p) => <button key={p} onClick={() => setPayment(p)} className={`rounded-2xl border px-4 py-4 font-black ${payment === p ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-100 bg-white"}`}>{p}</button>)}
            </div>
            <label className="mt-4 block"><span className="text-sm font-black text-zinc-600">Efectivo recibido</span><input type="text" disabled readOnly value={money(effectiveReceived)} className="mt-2 w-full rounded-2xl border border-zinc-100 bg-gray-50 px-4 py-3 text-right text-2xl font-black outline-none cursor-not-allowed" /></label>
            <TotalRow label="Cambio" value={money(totals.change)} strong />
            <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={printTicket} className="rounded-2xl border border-emerald-100 bg-white px-4 py-4 font-black text-emerald-700"><Printer className="mx-auto mb-1 h-5 w-5" /> Imprimir</button><button onClick={completeSale} className="rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-4 font-black text-white shadow-lg"><CreditCard className="mx-auto mb-1 h-5 w-5" /> Cobrar</button></div>
          </section>

          <section className="rounded-[2rem] border border-amber-100 bg-amber-50/80 p-5 text-sm text-amber-900 shadow-xl print:hidden">
            <div className="flex gap-3"><ShieldCheck className="h-6 w-6 shrink-0" /><div><p className="font-black">VeriFactu / Agencia Tributaria</p><p className="mt-1">Panel preparado para enviar facturas cuando se configure certificado digital, NIF fiscal, endpoint y firma. No se marca como enviada hasta tener respuesta válida.</p></div></div>
          </section>
        </aside>
      </div>
      {/* Stripe card modal */}
      {showCardModal && clientSecret && stripePromise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-lg w-full rounded-2xl bg-white p-6">
            <h3 className="text-xl font-bold mb-4">Pagar con tarjeta</h3>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CardPaymentForm
                clientSecret={clientSecret}
                onSuccess={() => {
                  setShowCardModal(false);
                  setClientSecret(null);
                  setInvoiceNumber((prev) => prev.replace(/(\d+)$/, (n) => String(Number(n) + 1).padStart(n.length, "0")));
                  clearSale();
                }}
                onCancel={() => closeCardModal()}
              />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
}

function Status({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-2xl border border-emerald-50 bg-emerald-50/50 p-3"><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-600" />{label}</span><span className="text-emerald-700">{value}</span></div>;
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between ${strong ? "text-2xl font-black text-emerald-800" : "font-bold text-zinc-600"}`}><span>{label}</span><span>{value}</span></div>;
}
