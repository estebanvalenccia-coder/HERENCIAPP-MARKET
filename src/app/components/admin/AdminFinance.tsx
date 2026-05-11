import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, DollarSign, Leaf, Plus, Receipt, RefreshCw, Sparkles, Trash2, TrendingUp, Wallet, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "motion/react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";
import { createCashClosure, createExpense, createSale, deleteExpense, deleteSale, getExpensesByDate, getMonthExpenses, getMonthSales, getSalesByDate } from "../../lib/finance/financeApi";
import type { DailyExpense, DailySale, PaymentMethod } from "../../lib/finance/financeTypes";
import { buildDailyIncomeChart, buildPaymentChart, calculateTotals, currentTime, money, todayISO } from "../../lib/finance/financeHelpers";

const pieColors = ["#4caf50", "#ec5f8f", "#7aa7e8", "#f6c66a", "#a78bfa"];
const paidStatuses = new Set(["paid", "confirmed", "preparing", "ready", "delivered", "completed"]);

const defaultSale = (date: string): Omit<DailySale, "id" | "created_at"> => ({ sale_date: date, time: currentTime(), client: "Cliente", product: "Ramo personalizado", category: "Ramos", payment_method: "Stripe", amount: 0, cost: 0, status: "Cobrado", notes: "" });
const defaultExpense = (date: string): Omit<DailyExpense, "id" | "created_at"> => ({ expense_date: date, category: "Flores", provider: "Proveedor", concept: "Compra diaria", amount: 0, payment_method: "Transferencia", status: "Pagado", notes: "" });

function payment(value: string): PaymentMethod {
  const v = String(value || "").toLowerCase();
  if (v.includes("efectivo") || v.includes("cash")) return "Efectivo";
  if (v.includes("bizum")) return "Bizum";
  if (v.includes("transfer")) return "Transferencia";
  if (v.includes("tarjeta") || v.includes("card")) return "Tarjeta";
  return "Stripe";
}

function orderToSale(order: any): DailySale {
  const date = new Date(order.date || order.created_at || Date.now());
  const items = Array.isArray(order.items) ? order.items : [];
  return { id: `order-${order.id}`, sale_date: date.toISOString().slice(0, 10), time: date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }), client: order.customerName || order.customerEmail || "Cliente online", product: items.map((i: any) => `${i.name || "Producto"} x${i.quantity || 1}`).join(", ") || "Pedido online", category: "Pedido real", payment_method: payment(order.paymentMethod), amount: Number(order.total || 0), cost: 0, status: "Cobrado", notes: `Pedido #${String(order.id || "").slice(0, 8)}`, created_at: order.date || order.created_at || new Date().toISOString() };
}

export function AdminFinance() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [sales, setSales] = useState<DailySale[]>([]);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [monthSales, setMonthSales] = useState<DailySale[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<DailyExpense[]>([]);
  const [ordersSynced, setOrdersSynced] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saleOpen, setSaleOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [saleForm, setSaleForm] = useState(defaultSale(selectedDate));
  const [expenseForm, setExpenseForm] = useState(defaultExpense(selectedDate));
  const [realCash, setRealCash] = useState(0);

  const totals = useMemo(() => calculateTotals(sales, expenses), [sales, expenses]);
  const monthTotals = useMemo(() => calculateTotals(monthSales, monthExpenses), [monthSales, monthExpenses]);
  const incomeChart = useMemo(() => buildDailyIncomeChart(monthSales), [monthSales]);
  const paymentChart = useMemo(() => buildPaymentChart(sales), [sales]);

  useEffect(() => { loadFinanceData(); }, [selectedDate]);

  async function getOrderSales() {
    try {
      const { orders } = await backendApi.listOrders();
      const paid = (orders || []).filter((o: any) => paidStatuses.has(o.status));
      setOrdersSynced(paid.length);
      return paid.map(orderToSale);
    } catch {
      setOrdersSynced(0);
      return [];
    }
  }

  async function loadFinanceData() {
    setLoading(true);
    try {
      const d = new Date(selectedDate);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
      const [manualDay, dayExpenses, manualMonth, expensesMonth, orderSales] = await Promise.all([getSalesByDate(selectedDate), getExpensesByDate(selectedDate), getMonthSales(year, month), getMonthExpenses(year, month), getOrderSales()]);
      const orderDay = orderSales.filter((s) => s.sale_date === selectedDate);
      const orderMonth = orderSales.filter((s) => s.sale_date?.startsWith(monthPrefix));
      const finalDay = [...orderDay, ...manualDay];
      setSales(finalDay);
      setExpenses(dayExpenses);
      setMonthSales([...orderMonth, ...manualMonth]);
      setMonthExpenses(expensesMonth);
      setRealCash(calculateTotals(finalDay, dayExpenses).expectedCash);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar las finanzas");
    } finally { setLoading(false); }
  }

  async function saveSale(e: React.FormEvent) { e.preventDefault(); await createSale({ ...saleForm, amount: Number(saleForm.amount), cost: Number(saleForm.cost) }); toast.success("Venta guardada"); setSaleOpen(false); setSaleForm(defaultSale(selectedDate)); loadFinanceData(); }
  async function saveExpense(e: React.FormEvent) { e.preventDefault(); await createExpense({ ...expenseForm, amount: Number(expenseForm.amount) }); toast.success("Gasto guardado"); setExpenseOpen(false); setExpenseForm(defaultExpense(selectedDate)); loadFinanceData(); }
  async function closeCash() { await createCashClosure({ closure_date: selectedDate, sales_total: totals.salesTotal, expenses_total: totals.expensesTotal, costs_total: totals.costsTotal, profit_total: totals.profit, expected_cash: totals.expectedCash, real_cash: Number(realCash), difference: Number(realCash) - totals.expectedCash, notes: "Cierre generado desde Admin Finanzas" }); toast.success("Caja cerrada"); setCashOpen(false); }
  async function removeSale(id?: string) { if (!id || id.startsWith("order-")) return; await deleteSale(id); loadFinanceData(); }
  async function removeExpense(id?: string) { if (!id) return; await deleteExpense(id); loadFinanceData(); }

  return <div className="relative -m-4 min-h-screen overflow-hidden rounded-[2rem] bg-gradient-to-br from-rose-50 via-white to-emerald-50 p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
    <div className="pointer-events-none absolute -left-16 top-28 text-9xl opacity-10">🌸</div><div className="pointer-events-none absolute right-5 top-28 text-8xl opacity-10">🌿</div>
    <div className="relative space-y-7">
      <section className="rounded-[2rem] border border-rose-100 bg-white/90 p-7 shadow-[0_24px_70px_rgba(16,185,129,0.14)] backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700"><Sparkles className="h-4 w-4" /> Modo CEO financiero · datos reales</div><h1 className="text-4xl font-black tracking-tight text-zinc-900 md:text-5xl">Finanzas & Contabilidad</h1><p className="mt-3 text-zinc-500">Control diario, pedidos reales, caja, gastos y beneficios de Herencia Market.</p><p className="mt-2 text-sm font-bold text-emerald-700">{ordersSynced} pedidos reales sincronizados desde Pedidos.</p></div>
        <div className="flex flex-col gap-3 sm:flex-row"><label className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-white px-4 py-3 font-bold text-zinc-700 shadow-sm"><CalendarDays className="h-5 w-5 text-rose-400" /><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent outline-none" /></label><button onClick={() => setSaleOpen(true)} className="rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-4 font-black text-white shadow-lg shadow-emerald-200">+ Añadir venta</button><button onClick={() => setExpenseOpen(true)} className="rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 px-6 py-4 font-black text-white shadow-lg shadow-rose-200">+ Añadir gasto</button><button onClick={loadFinanceData} className="rounded-2xl border border-emerald-100 bg-white px-4 py-4 text-emerald-700"><RefreshCw className="h-5 w-5" /></button></div></div>
      </section>

      {loading ? <Panel title="Cargando" subtitle="Leyendo pedidos y finanzas reales"><p className="py-8 text-center text-zinc-400">Cargando finanzas...</p></Panel> : <>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4"><FinanceCard title="Ventas hoy" value={money(totals.salesTotal)} icon={DollarSign} tone="green" /><FinanceCard title="Beneficio real" value={money(totals.profit)} icon={Leaf} tone="green" /><FinanceCard title="Gastos hoy" value={money(totals.expensesTotal)} icon={Receipt} tone="pink" /><FinanceCard title="Caja efectivo" value={money(totals.expectedCash)} icon={Wallet} tone="amber" /></div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3"><Panel className="xl:col-span-2" title="Ingresos del mes" subtitle="Pedidos reales + ventas manuales"><div className="h-[330px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={incomeChart}><CartesianGrid stroke="#f3e8e8" strokeDasharray="3 3" /><XAxis dataKey="day" stroke="#9f7a7a" /><YAxis stroke="#9f7a7a" /><Tooltip formatter={(v) => money(Number(v))} /><Area type="monotone" dataKey="income" stroke="#4caf50" strokeWidth={3} fill="#dcfce7" name="Ingresos" /><Area type="monotone" dataKey="profit" stroke="#ec5f8f" strokeWidth={3} fill="#fce7f3" name="Beneficio" /></AreaChart></ResponsiveContainer></div></Panel><Panel title="Métodos de pago" subtitle="Cobros del día"><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={paymentChart} dataKey="value" outerRadius={96} innerRadius={58}>{paymentChart.map((e, i) => <Cell key={e.name} fill={pieColors[i % pieColors.length]} />)}</Pie><Tooltip formatter={(v) => money(Number(v))} /></PieChart></ResponsiveContainer></div><div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-sm font-black text-zinc-700">Total ventas <span className="float-right">{money(totals.salesTotal)}</span></div></Panel></div>
        <Panel title="Ventas diarias" subtitle="Pedidos reales + ventas manuales del día"><div className="overflow-auto"><table className="w-full min-w-[940px] text-sm"><thead><tr className="bg-rose-50 text-left text-xs uppercase text-rose-700"><th className="p-4">Hora</th><th>Cliente</th><th>Producto</th><th>Pago</th><th>Venta</th><th>Coste</th><th>Beneficio</th><th>Estado</th><th></th></tr></thead><tbody className="divide-y divide-rose-50 bg-white">{sales.map((s) => <tr key={s.id} className="text-zinc-700"><td className="p-4 font-bold">{s.time}</td><td>{s.client}</td><td className="font-bold text-zinc-900">{s.product}</td><td>{s.payment_method}</td><td className="font-black">{money(Number(s.amount))}</td><td>{money(Number(s.cost))}</td><td className="font-black text-emerald-600">{money(Number(s.amount) - Number(s.cost))}</td><td><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{s.id?.startsWith("order-") ? "Pedido real" : s.status}</span></td><td><button disabled={s.id?.startsWith("order-")} onClick={() => removeSale(s.id)} className="text-rose-400 disabled:opacity-25"><Trash2 className="h-4 w-4" /></button></td></tr>)}{!sales.length && <tr><td colSpan={9} className="p-8 text-center text-zinc-400">No hay ventas para este día.</td></tr>}</tbody></table></div></Panel>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><Panel title="Gastos diarios" subtitle="Salidas de dinero del día"><div className="space-y-3">{expenses.map((e) => <div key={e.id} className="flex items-center justify-between rounded-3xl border border-rose-100 bg-rose-50/70 p-4"><div><p className="font-black text-zinc-900">{e.category}</p><p className="text-sm text-zinc-500">{e.provider} · {e.concept}</p></div><div className="flex items-center gap-4"><p className="font-black text-pink-600">-{money(Number(e.amount))}</p><button onClick={() => removeExpense(e.id)} className="text-pink-400"><Trash2 className="h-4 w-4" /></button></div></div>)}{!expenses.length && <p className="py-8 text-center text-zinc-400">No hay gastos.</p>}</div></Panel><Panel title="Cierre diario" subtitle="Resumen de caja"><div className="grid grid-cols-2 gap-3"><Mini label="Ventas" value={money(totals.salesTotal)} /><Mini label="Gastos" value={money(totals.expensesTotal)} /><Mini label="Beneficio" value={money(totals.profit)} /><Mini label="Efectivo" value={money(totals.expectedCash)} /></div><button onClick={() => setCashOpen(true)} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-4 font-black text-white shadow-lg shadow-emerald-100">Cerrar caja del día</button></Panel></div>
        <Panel title="IA financiera" subtitle="Resumen automático"><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><Ai text={`Este mes llevas ${money(monthTotals.salesTotal)} en ingresos.`} /><Ai text={`Beneficio estimado: ${money(monthTotals.profit)}.`} /><Ai text={`Ticket promedio hoy: ${money(totals.averageTicket)}.`} /></div></Panel>
      </>}
      {saleOpen && <Modal title="Añadir venta" onClose={() => setSaleOpen(false)}><form onSubmit={saveSale} className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Fecha" type="date" value={saleForm.sale_date} onChange={(v) => setSaleForm({ ...saleForm, sale_date: v })} /><Field label="Hora" value={saleForm.time} onChange={(v) => setSaleForm({ ...saleForm, time: v })} /><Field label="Cliente" value={saleForm.client} onChange={(v) => setSaleForm({ ...saleForm, client: v })} /><Field label="Producto" value={saleForm.product} onChange={(v) => setSaleForm({ ...saleForm, product: v })} /><Select label="Pago" value={saleForm.payment_method} options={["Efectivo", "Stripe", "Tarjeta", "Bizum", "Transferencia"]} onChange={(v) => setSaleForm({ ...saleForm, payment_method: v as PaymentMethod })} /><Field label="Categoría" value={saleForm.category} onChange={(v) => setSaleForm({ ...saleForm, category: v })} /><Field label="Venta" type="number" value={saleForm.amount} onChange={(v) => setSaleForm({ ...saleForm, amount: Number(v) })} /><Field label="Coste" type="number" value={saleForm.cost} onChange={(v) => setSaleForm({ ...saleForm, cost: Number(v) })} /><button className="md:col-span-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-white">Guardar venta</button></form></Modal>}
      {expenseOpen && <Modal title="Añadir gasto" onClose={() => setExpenseOpen(false)}><form onSubmit={saveExpense} className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Fecha" type="date" value={expenseForm.expense_date} onChange={(v) => setExpenseForm({ ...expenseForm, expense_date: v })} /><Field label="Categoría" value={expenseForm.category} onChange={(v) => setExpenseForm({ ...expenseForm, category: v })} /><Field label="Proveedor" value={expenseForm.provider} onChange={(v) => setExpenseForm({ ...expenseForm, provider: v })} /><Field label="Concepto" value={expenseForm.concept} onChange={(v) => setExpenseForm({ ...expenseForm, concept: v })} /><Select label="Pago" value={expenseForm.payment_method} options={["Efectivo", "Stripe", "Tarjeta", "Bizum", "Transferencia"]} onChange={(v) => setExpenseForm({ ...expenseForm, payment_method: v as PaymentMethod })} /><Field label="Importe" type="number" value={expenseForm.amount} onChange={(v) => setExpenseForm({ ...expenseForm, amount: Number(v) })} /><button className="md:col-span-2 rounded-2xl bg-pink-500 px-5 py-4 font-black text-white">Guardar gasto</button></form></Modal>}
      {cashOpen && <Modal title="Cerrar caja" onClose={() => setCashOpen(false)}><div className="space-y-4"><Mini label="Efectivo esperado" value={money(totals.expectedCash)} /><Field label="Efectivo contado real" type="number" value={realCash} onChange={(v) => setRealCash(Number(v))} /><Mini label="Diferencia" value={money(Number(realCash) - totals.expectedCash)} /><button onClick={closeCash} className="w-full rounded-2xl bg-emerald-500 px-5 py-4 font-black text-white">Guardar cierre</button></div></Modal>}
    </div>
  </div>;
}

function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle: string; children: React.ReactNode; className?: string }) { return <section className={`rounded-[2rem] border border-rose-100 bg-white/90 p-6 shadow-[0_20px_50px_rgba(24,24,27,0.07)] backdrop-blur-xl ${className}`}><div className="mb-5"><h2 className="text-2xl font-black text-zinc-900">{title}</h2><p className="text-sm text-zinc-500">{subtitle}</p></div>{children}</section>; }
function FinanceCard({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: "green" | "pink" | "amber" }) { const cls = tone === "pink" ? "text-pink-600 bg-pink-50" : tone === "amber" ? "text-amber-600 bg-amber-50" : "text-emerald-700 bg-emerald-50"; return <motion.div whileHover={{ y: -4 }} className="rounded-[2rem] border border-rose-100 bg-white/90 p-6 shadow-xl"><div className={`mb-5 inline-flex rounded-3xl p-4 ${cls}`}><Icon className="h-7 w-7" /></div><p className="text-sm font-bold text-zinc-500">{title}</p><h3 className={`mt-2 text-3xl font-black ${cls.split(" ")[0]}`}>{value}</h3></motion.div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-3xl border border-rose-100 bg-rose-50/60 p-4"><p className="text-sm font-bold text-zinc-500">{label}</p><p className="mt-1 text-2xl font-black text-zinc-900">{value}</p></div>; }
function Ai({ text }: { text: string }) { return <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{text}</div>; }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-[999] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm"><div className="w-full max-w-3xl rounded-[2rem] border border-rose-100 bg-white p-6 shadow-2xl"><div className="mb-6 flex items-center justify-between"><h3 className="text-2xl font-black text-zinc-900">{title}</h3><button onClick={onClose} className="rounded-xl bg-rose-50 p-2 text-rose-500"><X className="h-5 w-5" /></button></div>{children}</div></div>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) { return <label className="space-y-2"><span className="text-sm font-black text-zinc-600">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-zinc-900 outline-none focus:border-emerald-300" /></label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) { return <label className="space-y-2"><span className="text-sm font-black text-zinc-600">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-zinc-900 outline-none focus:border-emerald-300">{options.map((o) => <option key={o}>{o}</option>)}</select></label>; }
