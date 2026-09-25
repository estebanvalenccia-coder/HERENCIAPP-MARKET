import { useEffect, useMemo, useState } from "react";
import { User, Mail, Phone, MapPin, Package, LogOut, Bell, Gift, Sprout, Copy, Users, Download, Shield, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";

export function Profile() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [referralInput, setReferralInput] = useState("");
  const [reminders, setReminders] = useState<any[]>([]);
  const [reminderForm, setReminderForm] = useState({ title: "", date: "", leadDays: 7 });
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [account, wishlistResult] = await Promise.all([backendApi.customerAccount(), backendApi.customerWishlist()]);
      setUser(account.user);
      setOrders(account.orders || []);
      setLoyalty(account.loyalty || null);
      setReminders(account.reminders || []);
      setWishlist((wishlistResult.wishlist || []).map(String));
      try { setCatalog(JSON.parse(backendStorage.getItem("adminProducts") || "[]")); } catch { setCatalog([]); }
      await backendStorage.setItem("user", JSON.stringify({ ...account.user, isLoggedIn: true }));
    } catch {
      await backendStorage.removeItem("user");
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const activeOrders = useMemo(() => orders.filter((o) => !["delivered", "completed", "cancelled"].includes(o.status)), [orders]);

  const handleLogout = async () => {
    await backendApi.customerLogout().catch(() => null);
    await backendStorage.removeItem("user");
    toast.success("Sesión cerrada");
    navigate("/login");
  };

  const claimReferral = async () => {
    if (!referralInput.trim()) return toast.error("Escribe un código");
    try {
      const result = await backendApi.customerClaimReferral(referralInput.trim());
      toast.success(result.duplicate ? "Este referido ya estaba registrado" : "Código de referido aplicado");
      setReferralInput("");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo aplicar el código");
    }
  };

  const addReminder = async () => {
    if (!reminderForm.title.trim() || !reminderForm.date) return toast.error("Completa nombre y fecha");
    try {
      await backendApi.customerCreateReminder(reminderForm);
      setReminderForm({ title: "", date: "", leadDays: 7 });
      toast.success("Recordatorio guardado");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el recordatorio");
    }
  };

  const removeReminder = async (id: string) => {
    try {
      await backendApi.customerDeleteReminder(id);
      setReminders((rows) => rows.filter((item) => item.id !== id));
      toast.success("Recordatorio eliminado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo eliminar");
    }
  };

  const copyReferral = async () => {
    const code = user?.referralCode || "";
    if (!code) return;
    await navigator.clipboard?.writeText(code);
    toast.success("Código de referido copiado");
  };

  const exportPrivacyData = async () => {
    try {
      const data = await backendApi.customerPrivacyExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `herencia-mis-datos-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Tus datos se han exportado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron exportar tus datos");
    }
  };

  const deleteAccount = async () => {
    if (!confirm("¿Eliminar tu cuenta de Herencia? Esta acción no se puede deshacer. Los registros fiscales/ventas que legalmente deban conservarse pueden mantenerse.")) return;
    try {
      const result = await backendApi.customerPrivacyDeleteAccount();
      await backendStorage.removeItem("user");
      toast.success(result.retained || "Cuenta eliminada");
      navigate("/");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo eliminar la cuenta");
    }
  };

  if (loading) return <div className="min-h-[70vh] flex items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center"><User className="w-10 h-10 text-primary-foreground" /></div>
            <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold">{user.name || "Cliente"}</h1>{loyalty?.level && <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{loyalty.level}</span>}</div><p className="text-muted-foreground">{user.email}</p></div>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-destructive hover:bg-destructive/10 rounded-xl"><LogOut className="w-4 h-4" />Cerrar sesión</button>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8 space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={Package} label="Pedidos" value={String(orders.length)} detail={`${activeOrders.length} activos`} />
          <Card icon={Sprout} label="Puntos" value={String(loyalty?.points || 0)} detail={`${loyalty?.pointsPerEuro || 1} punto(s) por €`} />
          <Card icon={Gift} label="Crédito referidos" value={`€${Number(loyalty?.referralCredit || 0).toFixed(2)}`} detail={`${loyalty?.qualifiedReferrals || 0} referidos válidos`} />
          <Card icon={Users} label="Nivel" value={loyalty?.level || "Semilla"} detail={loyalty?.nextLevelAt ? `Siguiente a €${loyalty.nextLevelAt}` : "Nivel superior"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-bold text-lg mb-4">Tus datos</h2>
            <div className="space-y-3 text-sm">
              <p className="flex gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{user.email}</p>
              {user.phone && <p className="flex gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{user.phone}</p>}
              <p className="flex gap-2"><MapPin className="w-4 h-4 text-muted-foreground" />{user.address || "Sin dirección guardada"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <h2 className="font-bold text-lg">Invita a alguien a Herencia</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tu recompensa se contabiliza cuando la persona referida realiza una compra válida.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"><span className="font-mono text-lg font-bold tracking-wider">{user.referralCode}</span><button onClick={() => void copyReferral()} className="p-2 hover:bg-accent rounded-lg"><Copy className="w-4 h-4" /></button></div>
              <div className="flex flex-1 gap-2"><input value={referralInput} onChange={(e)=>setReferralInput(e.target.value.toUpperCase())} placeholder="¿Tienes un código?" className="flex-1 rounded-xl border border-border bg-background px-3 py-2" /><button onClick={() => void claimReferral()} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Aplicar</button></div>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Fechas importantes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Herencia puede avisarte por email antes de cumpleaños, aniversarios u otras fechas.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_140px_auto]">
            <input value={reminderForm.title} onChange={(e)=>setReminderForm({...reminderForm,title:e.target.value})} placeholder="Ej: Cumpleaños de mamá" className="rounded-xl border border-border bg-background p-3"/>
            <input type="date" value={reminderForm.date} onChange={(e)=>setReminderForm({...reminderForm,date:e.target.value})} className="rounded-xl border border-border bg-background p-3"/>
            <select value={reminderForm.leadDays} onChange={(e)=>setReminderForm({...reminderForm,leadDays:Number(e.target.value)})} className="rounded-xl border border-border bg-background p-3"><option value={1}>1 día antes</option><option value={3}>3 días antes</option><option value={7}>7 días antes</option><option value={14}>14 días antes</option></select>
            <button onClick={()=>void addReminder()} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">Guardar</button>
          </div>
          <div className="mt-4 space-y-2">{reminders.length===0?<p className="text-sm text-muted-foreground">No tienes fechas guardadas.</p>:reminders.map((r:any)=><div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 p-3"><div><p className="font-semibold">{r.title}</p><p className="text-xs text-muted-foreground">{r.date} · aviso {r.leadDays} día(s) antes</p></div><button onClick={()=>void removeReminder(r.id)} className="text-sm text-destructive">Eliminar</button></div>)}</div>
        </section>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6">Historial real de pedidos</h2>
          {orders.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no tienes pedidos asociados a esta cuenta.</p> : <div className="space-y-3">
            {orders.map((order, index) => <motion.div key={order.id} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{delay:Math.min(index*.03,.2)}} className="flex flex-col gap-3 rounded-xl bg-muted/30 p-4 sm:flex-row sm:items-center">
              <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">Pedido #{String(order.id).slice(0,8)}</span><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{order.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{new Date(order.date).toLocaleString("es-ES")} · {(order.items || []).reduce((n:number,i:any)=>n+Number(i.quantity||1),0)} productos</p>{order.metadata?.requestedDate && <p className="mt-1 text-xs text-muted-foreground">Entrega solicitada: {order.metadata.requestedDate}{order.metadata?.requestedTimeSlot ? ` · ${order.metadata.requestedTimeSlot}` : ""}</p>}</div>
              <div className="text-xl font-bold">€{Number(order.total || 0).toFixed(2)}</div>
            </motion.div>)}
          </div>}
        </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Tus favoritos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Se guardan en tu cuenta para que puedas recuperarlos en otros dispositivos.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.filter((p:any)=>wishlist.includes(String(p.id))&&!p.deletedAt&&p.active!==false).length===0
              ? <p className="text-sm text-muted-foreground sm:col-span-2">Todavía no has guardado favoritos.</p>
              : catalog.filter((p:any)=>wishlist.includes(String(p.id))&&!p.deletedAt&&p.active!==false).map((p:any)=><button key={p.id} onClick={()=>navigate(`/producto/${p.id}`)} className="overflow-hidden rounded-xl border border-border bg-background text-left"><img src={p.image} alt={p.name} className="h-32 w-full object-cover"/><div className="p-3"><p className="font-semibold line-clamp-1">{p.name}</p><p className="text-sm font-bold text-primary">€{Number(p.salePrice||p.price||0).toFixed(2)}</p></div></button>)}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary"/><h2 className="text-xl font-bold">Privacidad y tus datos</h2></div>
          <p className="mt-2 text-sm text-muted-foreground">Puedes descargar una copia de la información asociada a tu cuenta o cerrar tu cuenta. Los documentos de venta/facturación sujetos a conservación legal pueden mantenerse.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={()=>void exportPrivacyData()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold"><Download className="h-4 w-4"/>Exportar mis datos</button>
            <button onClick={()=>void deleteAccount()} className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"><Trash2 className="h-4 w-4"/>Eliminar mi cuenta</button>
          </div>
        </section>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm">
          <div className="flex gap-3"><Bell className="w-5 h-5 text-primary flex-shrink-0" /><div><p className="font-semibold">Programa Herencia</p><p className="text-muted-foreground">Semilla hasta 99 €, Brote desde 100 € y Jardín desde 300 € de compras válidas.</p></div></div>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, detail }: { icon:any; label:string; value:string; detail:string }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><Icon className="h-7 w-7 text-primary" /><p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}
