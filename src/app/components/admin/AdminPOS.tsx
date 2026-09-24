import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useElements, useStripe, CardElement } from "@stripe/react-stripe-js";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  Printer,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type PosPaymentMethod = "Efectivo" | "Tarjeta" | "Bizum" | "Transferencia";
type PosItem = { id: string; name: string; sku: string; price: number; iva: number; stock: number; category: string; image?: string };
type CartLine = PosItem & { qty: number };
type Customer = { id: string; name: string; nif: string; email: string; address: string; phone?: string };
type FiscalSettings = { businessName: string; nif: string; address: string; email: string; phone: string };
type SaleReceipt = {
  order: any;
  totals: { subtotal: number; tax: number; total: number; received: number; change: number };
  documentNumber: string;
  paymentMethod: PosPaymentMethod;
  customer: Customer;
  fiscal: FiscalSettings;
};

const WALK_IN: Customer = { id: "walk-in", name: "Cliente mostrador", nif: "", email: "", address: "", phone: "" };
const EMPTY_FISCAL: FiscalSettings = { businessName: "", nif: "", address: "", email: "", phone: "" };

function money(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function toPosItem(product: any): PosItem {
  const salePrice = Number(product?.salePrice || 0);
  const normalPrice = Number(product?.price || 0);
  const price = product?.onSale === true && salePrice > 0 ? salePrice : normalPrice;
  return {
    id: String(product?.id ?? ""),
    name: String(product?.name || "Producto"),
    sku: String(product?.sku || `SKU-${product?.id ?? "SIN-ID"}`),
    price: Number.isFinite(price) ? price : 0,
    iva: Number.isFinite(Number(product?.iva)) ? Number(product.iva) : 21,
    stock: Math.max(0, Math.floor(Number(product?.stock || 0))),
    category: String(product?.category || "Sin categoría"),
    image: product?.image || "",
  };
}

function CardPaymentForm({
  clientSecret,
  onPaid,
  onCancel,
}: {
  clientSecret: string;
  onPaid: (paymentIntentId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;
    setLoading(true);
    try {
      const result = await stripe.confirmCardPayment(clientSecret, { payment_method: { card } });
      if (result.error) {
        toast.error(result.error.message || "No se pudo procesar la tarjeta");
        return;
      }
      if (result.paymentIntent?.status !== "succeeded") {
        toast.error(`Stripe devolvió estado: ${result.paymentIntent?.status || "desconocido"}`);
        return;
      }
      await onPaid(result.paymentIntent.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <CardElement options={{ style: { base: { fontSize: "16px" } } }} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2">Cancelar</button>
        <button type="submit" disabled={loading || !stripe} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-60">
          {loading ? "Procesando..." : "Cobrar tarjeta"}
        </button>
      </div>
    </form>
  );
}

export function AdminPOS() {
  const stripePublishable = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
  const stripePromise = useMemo(() => (stripePublishable ? loadStripe(stripePublishable) : null), [stripePublishable]);

  const [products, setProducts] = useState<PosItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fiscal, setFiscal] = useState<FiscalSettings>(EMPTY_FISCAL);
  const [customer, setCustomer] = useState<Customer>(WALK_IN);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [payment, setPayment] = useState<PosPaymentMethod>("Efectivo");
  const [documentType, setDocumentType] = useState<"ticket" | "invoice">("ticket");
  const [notes, setNotes] = useState("");
  const [received, setReceived] = useState(0);
  const [keypad, setKeypad] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showFiscalModal, setShowFiscalModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Customer>({ id: "", name: "", nif: "", email: "", address: "", phone: "" });
  const [fiscalDraft, setFiscalDraft] = useState<FiscalSettings>(EMPTY_FISCAL);
  const [cardSession, setCardSession] = useState<{ clientSecret: string; orderId: string } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);
  const [testingSystem, setTestingSystem] = useState(false);
  const [selfTestResult, setSelfTestResult] = useState<{
    ok: boolean;
    cardReady: boolean;
    stockReady: boolean;
    fiscalReady: boolean;
    tests: Array<{ name: string; ok: boolean; detail: string }>;
  } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await backendApi.posBootstrap();
      const realProducts = (Array.isArray(data.products) ? data.products : []).filter((product: any) => product?.active !== false).map(toPosItem);
      const realCustomers = (Array.isArray(data.customers) ? data.customers : []).map((item: any) => ({
        id: String(item.id || crypto.randomUUID()),
        name: String(item.name || ""),
        nif: String(item.nif || ""),
        email: String(item.email || ""),
        address: String(item.address || ""),
        phone: String(item.phone || ""),
      }));
      setProducts(realProducts);
      setCustomers(realCustomers);
      setFiscal({ ...EMPTY_FISCAL, ...(data.fiscalSettings || {}) });
      setFiscalDraft({ ...EMPTY_FISCAL, ...(data.fiscalSettings || {}) });
      setBackendConnected(true);
    } catch (error: any) {
      setBackendConnected(false);
      toast.error(error?.message || "No se pudo conectar el TPV con el backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const categories = useMemo(() => ["Todos", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryOk = category === "Todos" || product.category === category;
      const queryOk = !q || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(q);
      return categoryOk && queryOk;
    });
  }, [products, query, category]);

  const totals = useMemo(() => {
    let total = 0;
    let subtotal = 0;
    for (const line of cart) {
      const lineTotal = line.price * line.qty;
      total += lineTotal;
      subtotal += lineTotal / (1 + line.iva / 100);
    }
    total = Math.round(total * 100) / 100;
    subtotal = Math.round(subtotal * 100) / 100;
    const tax = Math.round((total - subtotal) * 100) / 100;
    const change = Math.max(0, Math.round((received - total) * 100) / 100);
    return { subtotal, tax, total, change };
  }, [cart, received]);

  function addItem(product: PosItem) {
    if (product.stock <= 0) return toast.error("Este producto no tiene stock");
    setSelectedLineId(product.id);
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (!existing) return [...current, { ...product, qty: 1 }];
      if (existing.qty >= product.stock) {
        toast.error(`Stock máximo: ${product.stock}`);
        return current;
      }
      return current.map((line) => line.id === product.id ? { ...line, qty: line.qty + 1 } : line);
    });
  }

  function changeQty(id: string, delta: number) {
    setSelectedLineId(id);
    setCart((current) => current.map((line) => {
      if (line.id !== id) return line;
      const next = line.qty + delta;
      if (next <= 0) return { ...line, qty: 0 };
      if (next > line.stock) {
        toast.error(`Stock máximo: ${line.stock}`);
        return line;
      }
      return { ...line, qty: next };
    }).filter((line) => line.qty > 0));
  }

  function setSelectedQty() {
    const qty = Math.floor(Number(keypad || 0));
    if (!selectedLineId || qty <= 0) return toast.error("Selecciona un artículo y escribe una cantidad");
    setCart((current) => current.map((line) => {
      if (line.id !== selectedLineId) return line;
      if (qty > line.stock) {
        toast.error(`Stock máximo: ${line.stock}`);
        return line;
      }
      return { ...line, qty };
    }));
    setKeypad("");
  }

  function applyCash(sign: 1 | -1) {
    const amount = Number(keypad || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setReceived((current) => Math.max(0, Math.round((current + sign * amount) * 100) / 100));
    setKeypad("");
  }

  function pressKey(key: string) {
    setKeypad((current) => {
      if (key === ".") return current.includes(".") ? current : current ? current + "." : "0.";
      if (current.includes(".") && current.split(".")[1].length >= 2) return current;
      if (key === "00") return current ? current + "00" : "0";
      return current === "0" ? key : current + key;
    });
  }

  function removeLine(id: string) {
    setCart((current) => current.filter((line) => line.id !== id));
    if (selectedLineId === id) setSelectedLineId(null);
  }

  function clearSale() {
    setCart([]);
    setSelectedLineId(null);
    setCustomer(WALK_IN);
    setNotes("");
    setReceived(0);
    setKeypad("");
    setPayment("Efectivo");
    setDocumentType("ticket");
  }

  function invoiceRequirementsOk() {
    if (documentType !== "invoice") return true;
    if (!fiscal.businessName || !fiscal.nif || !fiscal.address) {
      toast.error("Configura los datos fiscales del negocio antes de emitir factura");
      setShowFiscalModal(true);
      return false;
    }
    if (!customer.name || !customer.nif || !customer.address || customer.id === "walk-in") {
      toast.error("La factura completa necesita cliente, NIF/CIF y dirección");
      return false;
    }
    return true;
  }

  function salePayload() {
    return {
      customer,
      items: cart.map((line) => ({ id: line.id, quantity: line.qty })),
      paymentMethod: payment,
      documentType,
      received,
      notes,
    };
  }

  async function completeNonCardSale() {
    if (!cart.length) return toast.error("Añade productos a la venta");
    if (!invoiceRequirementsOk()) return;
    if (payment === "Efectivo" && received < totals.total) return toast.error("El efectivo recibido es inferior al total");

    setSubmitting(true);
    try {
      const result = await backendApi.completePosSale(salePayload());
      setLastReceipt({
        order: result.order,
        totals: result.totals,
        documentNumber: result.documentNumber,
        paymentMethod: payment,
        customer,
        fiscal,
      });
      setProducts((Array.isArray(result.inventory) ? result.inventory : []).map(toPosItem));
      setBackendConnected(true);
      if (payment === "Bizum" || payment === "Transferencia") {
        toast.success(`${result.documentNumber} registrado. Pago pendiente de verificación.`);
      } else {
        toast.success(`${result.documentNumber} cobrado y stock actualizado`);
      }
      clearSale();
    } catch (error: any) {
      setBackendConnected(false);
      toast.error(error?.message || "No se pudo completar la venta");
    } finally {
      setSubmitting(false);
    }
  }

  async function startCardPayment() {
    if (!cart.length) return toast.error("Añade productos a la venta");
    if (!invoiceRequirementsOk()) return;
    if (!stripePublishable || !stripePromise) return toast.error("Falta VITE_STRIPE_PUBLISHABLE_KEY para cobrar con tarjeta");

    setSubmitting(true);
    try {
      const result = await backendApi.createPosCardIntent({
        customer,
        items: cart.map((line) => ({ id: line.id, quantity: line.qty })),
        documentType,
        notes,
      });
      setCardSession({ clientSecret: result.clientSecret, orderId: result.orderId });
    } catch (error: any) {
      toast.error(error?.message || "No se pudo iniciar el cobro con tarjeta");
    } finally {
      setSubmitting(false);
    }
  }

  async function cardPaid(paymentIntentId: string) {
    if (!cardSession) return;
    setSubmitting(true);
    try {
      await backendApi.confirmStripeOrder({ orderId: cardSession.orderId, paymentIntentId });
      const result = await backendApi.completePosSale({
        ...salePayload(),
        paymentMethod: "Tarjeta",
        existingOrderId: cardSession.orderId,
        paymentIntentId,
      });
      setLastReceipt({
        order: result.order,
        totals: result.totals,
        documentNumber: result.documentNumber,
        paymentMethod: "Tarjeta",
        customer,
        fiscal,
      });
      setProducts((Array.isArray(result.inventory) ? result.inventory : []).map(toPosItem));
      setBackendConnected(true);
      setCardSession(null);
      toast.success(`${result.documentNumber} cobrado con tarjeta y stock actualizado`);
      clearSale();
    } catch (error: any) {
      toast.error(error?.message || "El pago se cobró pero no se pudo cerrar la venta");
    } finally {
      setSubmitting(false);
    }
  }

  async function runSelfTest() {
    setTestingSystem(true);
    try {
      const result = await backendApi.posSelfTest();
      setSelfTestResult(result);
      if (result.ok && result.cardReady && result.stockReady) {
        toast.success("Autoprueba TPV correcta: backend, stock, cálculos y Stripe responden");
      } else if (result.ok) {
        toast.warning("Motor TPV correcto, pero hay configuración pendiente. Revisa el informe.");
      } else {
        toast.error("La autoprueba detectó un fallo en el TPV");
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo ejecutar la autoprueba TPV");
    } finally {
      setTestingSystem(false);
    }
  }

  async function saveCustomer() {
    if (!newCustomer.name.trim()) return toast.error("Escribe el nombre del cliente");
    try {
      const result = await backendApi.savePosCustomer({ ...newCustomer, id: newCustomer.id || crypto.randomUUID() });
      setCustomers(result.customers as Customer[]);
      setCustomer(result.customer as Customer);
      setNewCustomer({ id: "", name: "", nif: "", email: "", address: "", phone: "" });
      setShowCustomerModal(false);
      toast.success("Cliente guardado en el backend");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el cliente");
    }
  }

  async function saveFiscal() {
    try {
      const result = await backendApi.savePosFiscalSettings(fiscalDraft);
      const saved = { ...EMPTY_FISCAL, ...(result.settings || {}) };
      setFiscal(saved);
      setFiscalDraft(saved);
      setShowFiscalModal(false);
      toast.success("Datos fiscales guardados");
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron guardar los datos fiscales");
    }
  }

  function printReceipt() {
    if (!lastReceipt && !cart.length) return toast.error("No hay ticket o factura para imprimir");
    window.print();
  }

  const previewReceipt: SaleReceipt | null = lastReceipt || (cart.length ? {
    order: {
      items: cart.map((line) => ({ id: line.id, name: line.name, quantity: line.qty, price: line.price, iva: line.iva })),
      total: totals.total,
      subtotal: totals.subtotal,
      metadata: { notes },
    },
    totals: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total, received, change: totals.change },
    documentNumber: documentType === "invoice" ? "FACTURA BORRADOR" : "TICKET BORRADOR",
    paymentMethod: payment,
    customer,
    fiscal,
  } : null);

  const paymentHelp =
    payment === "Efectivo"
      ? "Se registra como pagado y calcula el cambio."
      : payment === "Tarjeta"
      ? "Cobro real mediante Stripe. El stock baja solo después del pago confirmado."
      : payment === "Bizum"
      ? "Se registra pendiente de verificar Bizum antes de tratarlo como ingreso pagado."
      : "Se registra pendiente de verificar la transferencia.";

  return (
    <div className="space-y-6 print:bg-white">
      <div className="flex flex-col gap-4 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm print:hidden lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-black text-zinc-950">TPV / Caja</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${backendConnected ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {backendConnected ? "Backend conectado" : "Sin conexión"}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">Catálogo, stock, clientes, pagos, pedidos y documentos conectados al backend.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void loadData()} className="rounded-xl border border-emerald-100 px-4 py-2 font-bold text-emerald-700">Actualizar stock</button>
          <button
            onClick={() => void runSelfTest()}
            disabled={testingSystem}
            className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 font-bold text-blue-700 disabled:opacity-60"
          >
            {testingSystem ? "Probando..." : "Probar TPV"}
          </button>
          <button onClick={() => setShowFiscalModal(true)} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 font-bold"><Settings className="h-4 w-4" /> Datos fiscales</button>
          <button onClick={printReceipt} className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 font-bold text-white"><Printer className="h-4 w-4" /> Imprimir</button>
        </div>
      </div>

      {selfTestResult && (
        <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black text-blue-950">Autoprueba del TPV</p>
              <p className="text-sm text-blue-800">
                Motor {selfTestResult.ok ? "OK" : "con errores"} · Tarjeta {selfTestResult.cardReady ? "lista" : "no lista"} · Stock {selfTestResult.stockReady ? "configurado" : "pendiente"} · Factura {selfTestResult.fiscalReady ? "configurada" : "pendiente"}
              </p>
            </div>
            <button onClick={() => setSelfTestResult(null)} className="rounded-lg bg-white px-3 py-1 text-sm font-bold text-blue-700">Cerrar</button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {selfTestResult.tests.map((test) => (
              <div key={test.name} className="flex items-start gap-2 rounded-xl bg-white/80 p-3 text-sm">
                <span className={test.ok ? "text-emerald-600" : "text-rose-600"}>{test.ok ? "✓" : "✕"}</span>
                <div><p className="font-bold text-zinc-900">{test.name.replaceAll("_", " ")}</p><p className="text-zinc-600">{test.detail}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_430px] print:hidden">
        <section className="space-y-5">
          <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, SKU o categoría..." className="w-full rounded-2xl border border-zinc-200 py-3 pl-12 pr-4 outline-none focus:border-emerald-400" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((item) => (
                <button key={item} onClick={() => setCategory(item)} className={`rounded-xl px-3 py-2 text-sm font-bold ${category === item ? "bg-emerald-600 text-white" : "border border-emerald-100 text-emerald-700"}`}>{item}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border bg-white p-12 text-center">Cargando stock real...</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <button key={product.id} onClick={() => addItem(product)} disabled={product.stock <= 0} className="rounded-3xl border border-zinc-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
                  {product.image ? <img src={product.image} alt={product.name} className="mb-3 h-32 w-full rounded-2xl object-cover" /> : <div className="mb-3 grid h-32 place-items-center rounded-2xl bg-emerald-50 text-4xl">🌿</div>}
                  <p className="text-xs font-bold uppercase text-emerald-600">{product.category} · {product.sku}</p>
                  <h3 className="mt-1 min-h-12 font-black text-zinc-900">{product.name}</h3>
                  <div className="mt-3 flex items-center justify-between"><span className="text-xl font-black text-emerald-700">{money(product.price)}</span><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold">Stock {product.stock}</span></div>
                  <p className="mt-2 text-xs text-zinc-500">IVA configurado: {product.iva}%</p>
                </button>
              ))}
            </div>
          )}
          {!loading && !filteredProducts.length && <div className="rounded-3xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center text-amber-900">No hay productos con stock para este filtro. El TPV ya no usa productos de demostración.</div>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="text-xl font-black">Venta actual</h3><p className="text-xs text-zinc-500">{documentType === "invoice" ? "Factura" : "Ticket"} · {cart.length} líneas</p></div>
              <ShoppingCart className="text-emerald-600" />
            </div>

            <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
              <select value={customer.id} onChange={(event) => {
                const selected = event.target.value === WALK_IN.id ? WALK_IN : customers.find((item) => item.id === event.target.value) || WALK_IN;
                setCustomer(selected);
              }} className="rounded-xl border border-zinc-200 px-3 py-2 font-semibold">
                <option value={WALK_IN.id}>{WALK_IN.name}</option>
                {customers.map((item) => <option key={item.id} value={item.id}>{item.name} {item.nif ? `· ${item.nif}` : ""}</option>)}
              </select>
              <button onClick={() => setShowCustomerModal(true)} className="rounded-xl bg-emerald-50 px-3 text-emerald-700" title="Añadir cliente"><UserPlus className="h-5 w-5" /></button>
            </div>

            <div className="max-h-72 divide-y overflow-auto rounded-2xl border border-zinc-100">
              {cart.map((line) => (
                <div key={line.id} onClick={() => setSelectedLineId(line.id)} className={`p-3 ${selectedLineId === line.id ? "bg-emerald-50" : "bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-bold">{line.name}</p><p className="text-xs text-zinc-500">{money(line.price)} · stock {line.stock}</p></div>
                    <button onClick={() => removeLine(line.id)} className="text-rose-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQty(line.id, -1)} className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-100"><Minus className="h-4 w-4" /></button>
                      <span className="w-8 text-center font-black">{line.qty}</span>
                      <button onClick={() => changeQty(line.id, 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-100"><Plus className="h-4 w-4" /></button>
                    </div>
                    <span className="font-black text-emerald-700">{money(line.price * line.qty)}</span>
                  </div>
                </div>
              ))}
              {!cart.length && <div className="p-8 text-center text-sm text-zinc-400">Sin artículos</div>}
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Base</span><b>{money(totals.subtotal)}</b></div>
              <div className="flex justify-between"><span>IVA</span><b>{money(totals.tax)}</b></div>
              <div className="flex justify-between text-2xl text-emerald-700"><span className="font-black">Total</span><b>{money(totals.total)}</b></div>
            </div>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notas de la venta" className="mt-4 w-full rounded-xl border border-zinc-200 p-3 text-sm" />
          </section>

          <section className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex gap-2">
              <button onClick={() => setDocumentType("ticket")} className={`flex-1 rounded-xl py-2 font-bold ${documentType === "ticket" ? "bg-zinc-900 text-white" : "border"}`}>Ticket</button>
              <button onClick={() => setDocumentType("invoice")} className={`flex-1 rounded-xl py-2 font-bold ${documentType === "invoice" ? "bg-zinc-900 text-white" : "border"}`}>Factura</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["Efectivo", "Tarjeta", "Bizum", "Transferencia"] as PosPaymentMethod[]).map((method) => (
                <button key={method} onClick={() => setPayment(method)} className={`rounded-xl border px-3 py-2 font-bold ${payment === method ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-200"}`}>{method}</button>
              ))}
            </div>
            <p className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">{paymentHelp}</p>

            {payment === "Efectivo" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold uppercase text-emerald-700">Recibido</p><p className="text-xl font-black">{money(received)}</p></div>
                <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-bold uppercase text-amber-700">Cambio</p><p className="text-xl font-black">{money(totals.change)}</p></div>
              </div>
            )}

            <div className="mt-4 rounded-2xl bg-zinc-950 p-4 text-white">
              <div className="mb-3 text-right text-3xl font-black">{keypad ? `${keypad.replace(".", ",")} €` : money(0)}</div>
              <div className="grid grid-cols-3 gap-2">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "00", "."].map((key) => <button key={key} onClick={() => pressKey(key)} className="rounded-xl bg-white/10 py-3 text-lg font-black hover:bg-white/20">{key}</button>)}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-sm font-black">
                <button onClick={() => applyCash(1)} className="rounded-xl bg-emerald-600 py-3">+</button>
                <button onClick={() => applyCash(-1)} className="rounded-xl bg-rose-600 py-3">−</button>
                <button onClick={setSelectedQty} className="rounded-xl bg-blue-600 py-3">× Uds.</button>
                <button onClick={() => setKeypad("")} className="rounded-xl bg-zinc-700 py-3">C</button>
              </div>
            </div>

            <button disabled={submitting || !cart.length} onClick={() => payment === "Tarjeta" ? void startCardPayment() : void completeNonCardSale()} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 py-4 text-lg font-black text-white shadow-lg disabled:opacity-50">
              {submitting ? "Procesando..." : payment === "Bizum" || payment === "Transferencia" ? `Registrar ${payment}` : `Cobrar ${money(totals.total)}`}
            </button>
          </section>

          {lastReceipt && (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 font-black text-emerald-800"><CheckCircle2 className="h-5 w-5" />Última operación: {lastReceipt.documentNumber}</div>
              <p className="mt-1 text-sm text-emerald-700">{money(lastReceipt.totals.total)} · {lastReceipt.paymentMethod}</p>
              <button onClick={printReceipt} className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-bold text-emerald-700"><Printer className="h-4 w-4" /> Imprimir documento</button>
            </section>
          )}
        </aside>
      </div>

      {showCustomerModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-black">Añadir cliente</h3><button onClick={() => setShowCustomerModal(false)}><X /></button></div>
            <div className="grid gap-3">
              <input placeholder="Nombre / Razón social" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className="rounded-xl border p-3" />
              <input placeholder="NIF / CIF" value={newCustomer.nif} onChange={(e) => setNewCustomer({ ...newCustomer, nif: e.target.value })} className="rounded-xl border p-3" />
              <input placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} className="rounded-xl border p-3" />
              <input placeholder="Teléfono" value={newCustomer.phone || ""} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="rounded-xl border p-3" />
              <textarea placeholder="Dirección fiscal" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} className="rounded-xl border p-3" />
              <button onClick={() => void saveCustomer()} className="rounded-xl bg-emerald-600 py-3 font-black text-white">Guardar cliente</button>
            </div>
          </div>
        </div>
      )}

      {showFiscalModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-black">Datos fiscales del emisor</h3><button onClick={() => setShowFiscalModal(false)}><X /></button></div>
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 flex-none" />Estos datos se imprimen en las facturas. La integración fiscal/VeriFactu debe configurarse aparte para cumplimiento tributario completo.</div>
            <div className="grid gap-3">
              <input placeholder="Nombre o razón social" value={fiscalDraft.businessName} onChange={(e) => setFiscalDraft({ ...fiscalDraft, businessName: e.target.value })} className="rounded-xl border p-3" />
              <input placeholder="NIF / CIF" value={fiscalDraft.nif} onChange={(e) => setFiscalDraft({ ...fiscalDraft, nif: e.target.value })} className="rounded-xl border p-3" />
              <textarea placeholder="Dirección fiscal" value={fiscalDraft.address} onChange={(e) => setFiscalDraft({ ...fiscalDraft, address: e.target.value })} className="rounded-xl border p-3" />
              <input placeholder="Email" value={fiscalDraft.email} onChange={(e) => setFiscalDraft({ ...fiscalDraft, email: e.target.value })} className="rounded-xl border p-3" />
              <input placeholder="Teléfono" value={fiscalDraft.phone} onChange={(e) => setFiscalDraft({ ...fiscalDraft, phone: e.target.value })} className="rounded-xl border p-3" />
              <button onClick={() => void saveFiscal()} className="rounded-xl bg-emerald-600 py-3 font-black text-white">Guardar datos fiscales</button>
            </div>
          </div>
        </div>
      )}

      {cardSession && stripePromise && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6">
            <div className="mb-4 flex items-center gap-3"><CreditCard className="text-emerald-600" /><h3 className="text-xl font-black">Cobro seguro con Stripe</h3></div>
            <Elements stripe={stripePromise} options={{ clientSecret: cardSession.clientSecret }}>
              <CardPaymentForm clientSecret={cardSession.clientSecret} onPaid={cardPaid} onCancel={() => setCardSession(null)} />
            </Elements>
          </div>
        </div>
      )}

      {previewReceipt && (
        <div className="hidden print:block print:p-8">
          <div className="mx-auto max-w-2xl text-black">
            <div className="border-b pb-4">
              <h1 className="text-2xl font-bold">{previewReceipt.fiscal.businessName || "Herencia Market"}</h1>
              {previewReceipt.fiscal.nif && <p>NIF/CIF: {previewReceipt.fiscal.nif}</p>}
              {previewReceipt.fiscal.address && <p>{previewReceipt.fiscal.address}</p>}
              {previewReceipt.fiscal.email && <p>{previewReceipt.fiscal.email}</p>}
            </div>
            <div className="my-5 flex justify-between gap-6">
              <div><p className="font-bold">{previewReceipt.documentNumber}</p><p>Fecha: {new Date(previewReceipt.order?.date || Date.now()).toLocaleString("es-ES")}</p><p>Pago: {previewReceipt.paymentMethod}</p></div>
              {previewReceipt.customer.id !== WALK_IN.id && <div className="text-right"><p className="font-bold">{previewReceipt.customer.name}</p>{previewReceipt.customer.nif && <p>NIF/CIF: {previewReceipt.customer.nif}</p>}{previewReceipt.customer.address && <p>{previewReceipt.customer.address}</p>}{previewReceipt.customer.email && <p>{previewReceipt.customer.email}</p>}</div>}
            </div>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b"><th className="py-2 text-left">Artículo</th><th className="py-2 text-right">Uds.</th><th className="py-2 text-right">Precio</th><th className="py-2 text-right">Total</th></tr></thead>
              <tbody>
                {(previewReceipt.order?.items || []).map((item: any, index: number) => (
                  <tr key={item.id || index} className="border-b"><td className="py-2">{item.name}</td><td className="py-2 text-right">{item.quantity || item.qty || 1}</td><td className="py-2 text-right">{money(Number(item.price || 0))}</td><td className="py-2 text-right">{money(Number(item.price || 0) * Number(item.quantity || item.qty || 1))}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto mt-5 w-72 space-y-1">
              <div className="flex justify-between"><span>Base</span><b>{money(previewReceipt.totals.subtotal)}</b></div>
              <div className="flex justify-between"><span>IVA</span><b>{money(previewReceipt.totals.tax)}</b></div>
              <div className="flex justify-between border-t pt-2 text-xl"><span>Total</span><b>{money(previewReceipt.totals.total)}</b></div>
              {previewReceipt.paymentMethod === "Efectivo" && <><div className="flex justify-between"><span>Recibido</span><b>{money(previewReceipt.totals.received)}</b></div><div className="flex justify-between"><span>Cambio</span><b>{money(previewReceipt.totals.change)}</b></div></>}
            </div>
            {previewReceipt.order?.metadata?.notes && <p className="mt-6 text-sm">Notas: {previewReceipt.order.metadata.notes}</p>}
            <p className="mt-8 text-center text-xs">Gracias por tu compra.</p>
          </div>
        </div>
      )}
    </div>
  );
}
