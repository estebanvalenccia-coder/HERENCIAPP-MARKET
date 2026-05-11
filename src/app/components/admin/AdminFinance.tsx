import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  DollarSign,
  LineChart as LineChartIcon,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  createCashClosure,
  createExpense,
  createSale,
  deleteExpense,
  deleteSale,
  getExpensesByDate,
  getMonthExpenses,
  getMonthSales,
  getSalesByDate,
} from "../../lib/finance/financeApi";
import type { DailyExpense, DailySale, PaymentMethod } from "../../lib/finance/financeTypes";
import {
  buildDailyIncomeChart,
  buildPaymentChart,
  calculateTotals,
  currentTime,
  money,
  todayISO,
} from "../../lib/finance/financeHelpers";
 
const pieColors = ["#22c55e", "#f472b6", "#38bdf8", "#facc15", "#a78bfa"];
 
const defaultSale = (date: string): Omit<DailySale, "id" | "created_at"> => ({
  sale_date: date,
  time: currentTime(),
  client: "Cliente",
  product: "Ramo personalizado",
  category: "Ramos",
  payment_method: "Stripe",
  amount: 0,
  cost: 0,
  status: "Cobrado",
  notes: "",
});
 
const defaultExpense = (date: string): Omit<DailyExpense, "id" | "created_at"> => ({
  expense_date: date,
  category: "Flores",
  provider: "Proveedor",
  concept: "Compra diaria",
  amount: 0,
  payment_method: "Transferencia",
  status: "Pagado",
  notes: "",
});
 
export function AdminFinance() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [sales, setSales] = useState<DailySale[]>([]);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [monthSales, setMonthSales] = useState<DailySale[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [saleForm, setSaleForm] = useState(defaultSale(selectedDate));
  const [expenseForm, setExpenseForm] = useState(defaultExpense(selectedDate));
  const [realCash, setRealCash] = useState(0);
 
  const totals = useMemo(() => calculateTotals(sales, expenses), [sales, expenses]);
  const monthTotals = useMemo(() => calculateTotals(monthSales, monthExpenses), [monthSales, monthExpenses]);
  const incomeChart = useMemo(() => buildDailyIncomeChart(monthSales), [monthSales]);
  const paymentChart = useMemo(() => buildPaymentChart(sales), [sales]);
  const monthlyChart = useMemo(() => {
    const now = new Date(selectedDate);
    return [
      {
        month: now.toLocaleDateString("es-ES", { month: "short" }),
        income: monthTotals.salesTotal,
        expenses: monthTotals.expensesTotal + monthTotals.costsTotal,
      },
    ];
  }, [selectedDate, monthTotals]);
 
  useEffect(() => {
    loadFinanceData();
  }, [selectedDate]);
 
  async function loadFinanceData() {
    setLoading(true);
    try {
      const date = new Date(selectedDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
 
      const [dailySales, dailyExpenses, salesMonth, expensesMonth] = await Promise.all([
        getSalesByDate(selectedDate),
        getExpensesByDate(selectedDate),
        getMonthSales(year, month),
        getMonthExpenses(year, month),
      ]);
 
      setSales(dailySales);
      setExpenses(dailyExpenses);
      setMonthSales(salesMonth);
      setMonthExpenses(expensesMonth);
      setRealCash(calculateTotals(dailySales, dailyExpenses).expectedCash);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar las finanzas. Revisa Supabase y el .env.");
    } finally {
      setLoading(false);
    }
  }
 
  async function handleCreateSale(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createSale({ ...saleForm, amount: Number(saleForm.amount), cost: Number(saleForm.cost) });
      toast.success("Venta guardada en Supabase");
      setSaleModalOpen(false);
      setSaleForm(defaultSale(selectedDate));
      await loadFinanceData();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar la venta");
    }
  }
 
  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createExpense({ ...expenseForm, amount: Number(expenseForm.amount) });
      toast.success("Gasto guardado en Supabase");
      setExpenseModalOpen(false);
      setExpenseForm(defaultExpense(selectedDate));
      await loadFinanceData();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar el gasto");
    }
  }
 
  async function handleCloseCash() {
    try {
      await createCashClosure({
        closure_date: selectedDate,
        sales_total: totals.salesTotal,
        expenses_total: totals.expensesTotal,
        costs_total: totals.costsTotal,
        profit_total: totals.profit,
        expected_cash: totals.expectedCash,
        real_cash: Number(realCash),
        difference: Number(realCash) - totals.expectedCash,
        notes: "Cierre generado desde Admin Finanzas",
      });
      toast.success("Caja cerrada y guardada en Supabase");
      setCashModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cerrar caja");
    }
  }
 
  async function handleDeleteSale(id?: string) {
    if (!id) return;
    await deleteSale(id);
    toast.success("Venta eliminada");
    await loadFinanceData();
  }
 
  async function handleDeleteExpense(id?: string) {
    if (!id) return;
    await deleteExpense(id);
    toast.success("Gasto eliminado");
    await loadFinanceData();
  }
 
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 p-8 shadow-2xl">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-pink-500/10 blur-3xl" />
 
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300">
              <Sparkles className="h-4 w-4" />
              Modo CEO financiero
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">Finanzas & Contabilidad</h1>
            <p className="mt-3 max-w-2xl text-zinc-300">
              Ventas diarias, gastos, caja, contabilidad mensual y gráficos premium guardados en Supabase.
            </p>
          </div>
 
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-semibold text-white outline-none"
            />
            <button onClick={() => setSaleModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-6 py-4 font-bold text-zinc-950 transition hover:scale-105 hover:bg-emerald-300">
              <Plus className="h-5 w-5" /> Añadir venta
            </button>
          </div>
        </div>
      </div>
 
      {loading ? (
        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-300">Cargando finanzas...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <FinanceCard title="Ventas hoy" value={money(totals.salesTotal)} icon={DollarSign} trend="LIVE" />
            <FinanceCard title="Beneficio real" value={money(totals.profit)} icon={TrendingUp} trend="NETO" />
            <FinanceCard title="Gastos hoy" value={money(totals.expensesTotal)} icon={Receipt} trend="SALIDA" negative />
            <FinanceCard title="Caja efectivo" value={money(totals.expectedCash)} icon={Wallet} trend="CAJA" />
          </div>
 
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Ingresos mensuales por día</h2>
                  <p className="text-sm text-zinc-400">Evolución real desde Supabase.</p>
                </div>
                <LineChartIcon className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={incomeChart}>
                    <defs>
                      <linearGradient id="income" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profit" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#f472b6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="#a1a1aa" />
                    <YAxis stroke="#a1a1aa" />
                    <Tooltip />
                    <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={3} fill="url(#income)" />
                    <Area type="monotone" dataKey="profit" stroke="#f472b6" strokeWidth={3} fill="url(#profit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
 
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
              <h2 className="text-2xl font-bold text-white">Métodos de pago</h2>
              <p className="text-sm text-zinc-400">Cobros del día seleccionado.</p>
              <div className="mt-6 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentChart} dataKey="value" outerRadius={105} innerRadius={60}>
                      {paymentChart.map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => money(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
 
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-white">Contabilidad mensual</h2>
            <p className="text-sm text-zinc-400">Ingresos vs gastos/costes del mes seleccionado.</p>
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChart}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Bar dataKey="income" fill="#22c55e" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="expenses" fill="#f472b6" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
 
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Ventas diarias</h2>
                <p className="text-sm text-zinc-400">Registro financiero diario guardado en Supabase.</p>
              </div>
              <button onClick={() => setSaleModalOpen(true)} className="rounded-2xl bg-emerald-400 px-5 py-3 font-bold text-zinc-950 transition hover:bg-emerald-300">+ Añadir venta</button>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                    <th className="pb-4">Hora</th><th className="pb-4">Cliente</th><th className="pb-4">Producto</th><th className="pb-4">Pago</th><th className="pb-4">Venta</th><th className="pb-4">Coste</th><th className="pb-4">Beneficio</th><th className="pb-4">Estado</th><th className="pb-4">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-zinc-900 text-sm">
                      <td className="py-4 text-zinc-300">{sale.time}</td>
                      <td className="py-4 text-zinc-300">{sale.client}</td>
                      <td className="py-4 font-semibold text-white">{sale.product}</td>
                      <td className="py-4 text-zinc-300">{sale.payment_method}</td>
                      <td className="py-4 font-bold text-white">{money(Number(sale.amount))}</td>
                      <td className="py-4 text-zinc-400">{money(Number(sale.cost))}</td>
                      <td className="py-4 font-bold text-emerald-400">{money(Number(sale.amount) - Number(sale.cost))}</td>
                      <td className="py-4"><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">{sale.status}</span></td>
                      <td className="py-4"><button onClick={() => handleDeleteSale(sale.id)} className="text-pink-300 hover:text-pink-200"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                  {!sales.length && <tr><td colSpan={9} className="py-8 text-center text-zinc-500">No hay ventas para este día.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
 
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <div><h2 className="text-2xl font-bold text-white">Gastos diarios</h2><p className="text-sm text-zinc-400">Salidas de dinero del día.</p></div>
                <button onClick={() => setExpenseModalOpen(true)} className="rounded-2xl bg-pink-300 px-5 py-3 font-bold text-zinc-950">+ Añadir gasto</button>
              </div>
              <div className="space-y-4">
                {expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <div><p className="font-bold text-white">{expense.category}</p><p className="text-sm text-zinc-400">{expense.provider} · {expense.concept}</p></div>
                    <div className="flex items-center gap-4"><div className="text-right"><p className="font-bold text-pink-400">-{money(Number(expense.amount))}</p><p className="text-xs text-zinc-500">{expense.payment_method}</p></div><button onClick={() => handleDeleteExpense(expense.id)} className="text-pink-300"><Trash2 className="h-4 w-4" /></button></div>
                  </div>
                ))}
                {!expenses.length && <p className="py-8 text-center text-zinc-500">No hay gastos para este día.</p>}
              </div>
            </div>
 
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
              <h2 className="text-2xl font-bold text-white">Cierre diario</h2>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ClosureBox label="Ventas" value={money(totals.salesTotal)} icon={Banknote} />
                <ClosureBox label="Gastos" value={money(totals.expensesTotal)} icon={Receipt} />
                <ClosureBox label="Beneficio" value={money(totals.profit)} icon={TrendingUp} />
                <ClosureBox label="Efectivo esperado" value={money(totals.expectedCash)} icon={CreditCard} />
              </div>
              <button onClick={() => setCashModalOpen(true)} className="mt-6 w-full rounded-2xl bg-white px-5 py-4 font-black text-zinc-950 transition hover:bg-emerald-300">Cerrar caja del día</button>
            </div>
          </div>
 
          <div className="rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-zinc-950 to-emerald-950 p-6 shadow-xl">
            <div className="mb-6 flex items-center gap-3"><div className="rounded-2xl bg-emerald-400/10 p-3"><Sparkles className="h-6 w-6 text-emerald-300" /></div><div><h2 className="text-2xl font-bold text-white">IA financiera</h2><p className="text-sm text-zinc-400">Insights inteligentes basados en tus datos.</p></div></div>
            <div className="space-y-4">
              <AiMessage text={`Este mes llevas ${money(monthTotals.salesTotal)} en ingresos registrados.`} />
              <AiMessage text={`El beneficio estimado del mes es ${money(monthTotals.profit)}.`} />
              <AiMessage text={`Tu ticket promedio hoy es ${money(totals.averageTicket)}.`} />
              {totals.expensesTotal > totals.salesTotal * 0.45 && <AiMessage text="Alerta: los gastos del día están altos respecto a las ventas." warning />}
            </div>
          </div>
        </>
      )}
 
      {saleModalOpen && (
        <FinanceModal title="Añadir venta" onClose={() => setSaleModalOpen(false)}>
          <form onSubmit={handleCreateSale} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Fecha" type="date" value={saleForm.sale_date} onChange={(v) => setSaleForm({ ...saleForm, sale_date: v })} />
            <Field label="Hora" value={saleForm.time} onChange={(v) => setSaleForm({ ...saleForm, time: v })} />
            <Field label="Cliente" value={saleForm.client} onChange={(v) => setSaleForm({ ...saleForm, client: v })} />
            <Field label="Producto" value={saleForm.product} onChange={(v) => setSaleForm({ ...saleForm, product: v })} />
            <SelectField label="Pago" value={saleForm.payment_method} options={["Efectivo", "Stripe", "Tarjeta", "Bizum", "Transferencia"]} onChange={(v) => setSaleForm({ ...saleForm, payment_method: v as PaymentMethod })} />
            <Field label="Categoría" value={saleForm.category} onChange={(v) => setSaleForm({ ...saleForm, category: v })} />
            <Field label="Venta" type="number" value={saleForm.amount} onChange={(v) => setSaleForm({ ...saleForm, amount: Number(v) })} />
            <Field label="Coste" type="number" value={saleForm.cost} onChange={(v) => setSaleForm({ ...saleForm, cost: Number(v) })} />
            <div className="md:col-span-2"><button className="w-full rounded-2xl bg-emerald-400 px-5 py-4 font-black text-zinc-950">Guardar venta</button></div>
          </form>
        </FinanceModal>
      )}
 
      {expenseModalOpen && (
        <FinanceModal title="Añadir gasto" onClose={() => setExpenseModalOpen(false)}>
          <form onSubmit={handleCreateExpense} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Fecha" type="date" value={expenseForm.expense_date} onChange={(v) => setExpenseForm({ ...expenseForm, expense_date: v })} />
            <Field label="Categoría" value={expenseForm.category} onChange={(v) => setExpenseForm({ ...expenseForm, category: v })} />
            <Field label="Proveedor" value={expenseForm.provider} onChange={(v) => setExpenseForm({ ...expenseForm, provider: v })} />
            <Field label="Concepto" value={expenseForm.concept} onChange={(v) => setExpenseForm({ ...expenseForm, concept: v })} />
            <SelectField label="Pago" value={expenseForm.payment_method} options={["Efectivo", "Stripe", "Tarjeta", "Bizum", "Transferencia"]} onChange={(v) => setExpenseForm({ ...expenseForm, payment_method: v as PaymentMethod })} />
            <Field label="Importe" type="number" value={expenseForm.amount} onChange={(v) => setExpenseForm({ ...expenseForm, amount: Number(v) })} />
            <div className="md:col-span-2"><button className="w-full rounded-2xl bg-pink-300 px-5 py-4 font-black text-zinc-950">Guardar gasto</button></div>
          </form>
        </FinanceModal>
      )}
 
      {cashModalOpen && (
        <FinanceModal title="Cerrar caja" onClose={() => setCashModalOpen(false)}>
          <div className="space-y-4">
            <ClosureBox label="Efectivo esperado" value={money(totals.expectedCash)} icon={Wallet} />
            <Field label="Efectivo contado real" type="number" value={realCash} onChange={(v) => setRealCash(Number(v))} />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-sm text-zinc-400">Diferencia</p><p className="text-3xl font-black text-white">{money(Number(realCash) - totals.expectedCash)}</p></div>
            <button onClick={handleCloseCash} className="w-full rounded-2xl bg-white px-5 py-4 font-black text-zinc-950">Guardar cierre</button>
          </div>
        </FinanceModal>
      )}
    </div>
  );
}
 
function FinanceCard({ title, value, icon: Icon, trend, negative }: { title: string; value: string; icon: any; trend: string; negative?: boolean }) {
  return <motion.div whileHover={{ y: -4 }} className="rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900 p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><div className="rounded-2xl bg-zinc-800 p-4"><Icon className="h-7 w-7 text-emerald-300" /></div><span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${negative ? "bg-pink-400/10 text-pink-300" : "bg-emerald-400/10 text-emerald-300"}`}>{negative ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}{trend}</span></div><p className="text-sm text-zinc-400">{title}</p><h3 className="mt-2 text-3xl font-black text-white">{value}</h3></motion.div>;
}
 
function AiMessage({ text, warning }: { text: string; warning?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${warning ? "border-pink-400/20 bg-pink-400/10" : "border-emerald-400/20 bg-emerald-400/10"}`}><p className="text-sm text-zinc-200">{text}</p></div>;
}
 
function ClosureBox({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"><Icon className="mb-3 h-5 w-5 text-emerald-300" /><p className="text-sm text-zinc-400">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></div>;
}
 
function FinanceModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-3xl rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"><div className="mb-6 flex items-center justify-between"><h3 className="text-2xl font-black text-white">{title}</h3><button onClick={onClose} className="rounded-xl bg-zinc-800 p-2 text-white"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}
 
function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="space-y-2"><span className="text-sm font-semibold text-zinc-300">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-400" /></label>;
}
 
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="space-y-2"><span className="text-sm font-semibold text-zinc-300">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-400">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
