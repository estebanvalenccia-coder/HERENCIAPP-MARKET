import { useEffect, useMemo, useState } from "react";
import { Boxes, Globe2, ImageIcon, MapPinned, Save, Settings2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";
import {
  COLOMBIA_DELIVERY_STORAGE_KEY,
  defaultColombiaDeliverySettings,
  parseColombiaDeliverySettings,
  type ColombiaDeliverySettings,
} from "../../lib/internationalDelivery";

type Tab = "general" | "zones" | "catalog" | "orders" | "partners" | "cards";

export function AdminInternationalDelivery() {
  const [settings, setSettings] = useState<ColombiaDeliverySettings>(defaultColombiaDeliverySettings);
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("general");
  const selected = useMemo(() => new Set(settings.selectedProductIds.map(String)), [settings.selectedProductIds]);

  useEffect(() => {
    setSettings(parseColombiaDeliverySettings(backendStorage.getItem(COLOMBIA_DELIVERY_STORAGE_KEY)));
    backendApi.listCommerceProducts({ includeArchived: true })
      .then(({ products }) => setProducts(Array.isArray(products) ? products.filter((p:any) => !p?.deletedAt) : []))
      .catch(() => setProducts([]));
    backendApi.listOrders()
      .then(({ orders }) => setOrders((Array.isArray(orders) ? orders : []).filter((order:any) => order?.metadata?.source === "colombia_checkout")))
      .catch(() => setOrders([]));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const result = await backendStorage.setItem(COLOMBIA_DELIVERY_STORAGE_KEY, JSON.stringify(settings));
      if (!result.ok) throw new Error(result.error || "No se pudo sincronizar");
      toast.success("Colombia / Internacional guardado y publicado");
    } catch (error:any) {
      toast.error(error?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (id:string) => {
    const next = new Set(settings.selectedProductIds.map(String));
    if (next.has(id)) next.delete(id); else next.add(id);
    setSettings({ ...settings, selectedProductIds: [...next] });
  };

  const patchZone = (index:number, patch:any) => {
    const zones = settings.zones.map((zone, i) => i === index ? { ...zone, ...patch } : zone);
    setSettings({ ...settings, zones });
  };

  const patchProduct = (id:string, patch:any) => {
    setSettings({
      ...settings,
      productOverrides: {
        ...settings.productOverrides,
        [id]: {
          enabled: settings.productOverrides[id]?.enabled !== false,
          priceCOP: Number(settings.productOverrides[id]?.priceCOP || 0),
          trackInventoryColombia: Boolean(settings.productOverrides[id]?.trackInventoryColombia),
          stockColombia: Math.max(0, Math.floor(Number(settings.productOverrides[id]?.stockColombia || 0))),
          ...patch,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Globe2 className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-muted-foreground">Herencia internacional</p>
              <h2 className="text-2xl font-bold">Colombia · Cali, Candelaria y alrededores</h2>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar y publicar"}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b pb-4">
          {[
            ["general","General",Settings2],
            ["zones","Zonas de entrega",MapPinned],
            ["catalog","Catálogo",Boxes],
            ["orders","Pedidos",Boxes],
            ["partners","Aliados",Globe2],
            ["cards","Tarjetas",ImageIcon],
          ].map(([id,label,Icon]:any)=>(
            <button key={id} onClick={()=>setTab(id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${tab===id?"bg-primary text-primary-foreground":"bg-muted/60 hover:bg-muted"}`}>
              <Icon className="h-4 w-4"/>{label}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ToggleCard label="Servicio activo" checked={settings.enabled} onChange={(checked)=>setSettings({...settings,enabled:checked})} detail="Mostrar la experiencia Colombia al público." />
              <ToggleCard label="Mensajes de regalo" checked={settings.giftMessageEnabled} onChange={(checked)=>setSettings({...settings,giftMessageEnabled:checked})} detail="Permitir tarjeta personalizada." />
              <ToggleCard label="Entrega sorpresa" checked={settings.surpriseEnabled} onChange={(checked)=>setSettings({...settings,surpriseEnabled:checked})} detail="Ocultar precio al destinatario." />
              <ToggleCard label="Fecha y horario" checked={settings.schedulingEnabled} onChange={(checked)=>setSettings({...settings,schedulingEnabled:checked})} detail="Permitir programar la entrega." />
            </div>
            <ToggleCard label="Pago online Colombia" checked={settings.paymentEnabled} onChange={(checked)=>setSettings({...settings,paymentEnabled:checked})} detail="Cobra pedidos Colombia en COP usando la misma cuenta Stripe de Herencia." />
            <div className="grid gap-4 lg:grid-cols-2">
              <label><span className="mb-2 block text-sm font-bold">Título principal</span><input value={settings.headline} onChange={(e)=>setSettings({...settings,headline:e.target.value})} className="w-full rounded-xl border bg-background px-4 py-3" /></label>
              <label><span className="mb-2 block text-sm font-bold">Cobertura visible</span><input value={settings.regionLabel} onChange={(e)=>setSettings({...settings,regionLabel:e.target.value})} className="w-full rounded-xl border bg-background px-4 py-3" /></label>
              <label className="lg:col-span-2"><span className="mb-2 block text-sm font-bold">Descripción</span><textarea value={settings.description} onChange={(e)=>setSettings({...settings,description:e.target.value})} rows={3} className="w-full rounded-xl border bg-background px-4 py-3" /></label>
              <label className="lg:col-span-2"><span className="mb-2 block text-sm font-bold">Imagen de portada (URL)</span><input value={settings.heroImageUrl} onChange={(e)=>setSettings({...settings,heroImageUrl:e.target.value})} className="w-full rounded-xl border bg-background px-4 py-3" /></label>
              <label className="lg:col-span-2"><span className="mb-2 block text-sm font-bold">Texto de entrega rápida</span><input value={settings.sameDayLabel} onChange={(e)=>setSettings({...settings,sameDayLabel:e.target.value})} className="w-full rounded-xl border bg-background px-4 py-3" /></label>
            </div>
          </div>
        )}

        {tab === "zones" && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="text-xl font-bold">Zonas y domicilios</h3><p className="text-sm text-muted-foreground">Gestiona precio en COP, equivalente en EUR y tiempos.</p></div>
              <button onClick={() => setSettings({...settings,zones:[...settings.zones,{id:`zona-${Date.now()}`,name:"Nueva zona",enabled:true,feeEUR:0,feeCOP:0,eta:"A confirmar",note:""}]})} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><Plus className="h-4 w-4"/>Añadir zona</button>
            </div>
            <div className="mt-5 space-y-3">
              {settings.zones.map((zone,index)=>(
                <div key={zone.id} className="grid gap-3 rounded-2xl border p-4 xl:grid-cols-[auto_1.2fr_.6fr_.6fr_1fr_1.4fr_auto] xl:items-center">
                  <input type="checkbox" checked={zone.enabled} onChange={(e)=>patchZone(index,{enabled:e.target.checked})} />
                  <input value={zone.name} onChange={(e)=>patchZone(index,{name:e.target.value})} className="rounded-xl border bg-background px-3 py-2" />
                  <input type="number" min="0" step="100" value={zone.feeCOP} onChange={(e)=>patchZone(index,{feeCOP:Number(e.target.value)})} className="rounded-xl border bg-background px-3 py-2" placeholder="COP" />
                  <input type="number" min="0" step="0.1" value={zone.feeEUR} onChange={(e)=>patchZone(index,{feeEUR:Number(e.target.value)})} className="rounded-xl border bg-background px-3 py-2" placeholder="EUR" />
                  <input value={zone.eta} onChange={(e)=>patchZone(index,{eta:e.target.value})} className="rounded-xl border bg-background px-3 py-2" />
                  <input value={zone.note} onChange={(e)=>patchZone(index,{note:e.target.value})} className="rounded-xl border bg-background px-3 py-2" />
                  <button onClick={()=>setSettings({...settings,zones:settings.zones.filter((_,i)=>i!==index)})} className="rounded-xl p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "catalog" && (
          <div className="mt-6">
            <h3 className="text-xl font-bold">Catálogo Colombia</h3>
            <p className="mt-1 text-sm text-muted-foreground">Selecciona productos y define un precio colombiano independiente.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product:any)=>{
                const id=String(product.id);
                const active=selected.has(id);
                const override=settings.productOverrides[id];
                return (
                  <div key={id} className={`rounded-2xl border p-3 transition ${active?"border-primary bg-primary/5":"bg-card"}`}>
                    <button onClick={()=>toggleProduct(id)} className="flex w-full items-center gap-3 text-left">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">{product.image && <img src={product.image} alt="" className="h-full w-full object-cover" />}</div>
                      <div className="min-w-0 flex-1"><p className="truncate font-bold">{product.name}</p><p className="text-xs text-muted-foreground">{active?"Disponible en Colombia":"No seleccionado"}</p></div>
                    </button>
                    {active && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input type="number" min="0" step="100" value={override?.priceCOP || ""} onChange={(e)=>patchProduct(id,{priceCOP:Number(e.target.value)})} placeholder="Precio COP" className="rounded-xl border bg-background px-3 py-2 text-sm" />
                        <input value={override?.label || ""} onChange={(e)=>patchProduct(id,{label:e.target.value})} placeholder="Nombre Colombia" className="rounded-xl border bg-background px-3 py-2 text-sm" />
                        <label className="col-span-2 flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs font-bold">
                          <input type="checkbox" checked={Boolean(override?.trackInventoryColombia)} onChange={(e)=>patchProduct(id,{trackInventoryColombia:e.target.checked})} />
                          Controlar stock Colombia independientemente
                        </label>
                        {override?.trackInventoryColombia && (
                          <input type="number" min="0" step="1" value={override?.stockColombia ?? 0} onChange={(e)=>patchProduct(id,{stockColombia:Math.max(0,Math.floor(Number(e.target.value||0)))})} placeholder="Stock Colombia" className="col-span-2 rounded-xl border bg-background px-3 py-2 text-sm" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="mt-6">
            <h3 className="text-xl font-bold">Pedidos Colombia</h3>
            <p className="mt-1 text-sm text-muted-foreground">Pedidos reales cobrados por Stripe y gestionados desde Herencia.</p>
            <div className="mt-5 space-y-3">
              {orders.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Todavía no hay pedidos Colombia.</div>
              ) : orders.map((order:any) => (
                <div key={order.id} className="rounded-2xl border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black">#{String(order.id).slice(0,8)}</span>
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-[10px] font-black text-yellow-900">🇨🇴 COP</span>
                        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold">{order.status}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold">{order.customerName} · {order.customerEmail}</p>
                      <p className="text-xs text-muted-foreground">{order.metadata?.recipientName ? `Entrega a ${order.metadata.recipientName}` : "Destinatario Colombia"} · {order.metadata?.deliveryZoneName || ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-xl font-black">{new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(order.total||0))}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "partners" && <Placeholder title="Aliados locales" text="Preparado para gestionar floristerías, repartidores o proveedores de Cali y Candelaria." />}
        {tab === "cards" && <Placeholder title="Tarjetas y mensajes" text="La experiencia pública ya permite mensajes y ocasiones. Aquí podremos añadir diseños de tarjetas por ocasión." />}
      </div>
    </div>
  );
}

function ToggleCard({ label, checked, onChange, detail }: { label:string; checked:boolean; onChange:(v:boolean)=>void; detail:string }) {
  return <label className="rounded-2xl border p-4"><span className="flex items-center justify-between gap-3"><span className="font-bold">{label}</span><input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} /></span><span className="mt-2 block text-xs leading-5 text-muted-foreground">{detail}</span></label>;
}

function Placeholder({ title, text }: { title:string; text:string }) {
  return <div className="mt-6 rounded-3xl border border-dashed p-10 text-center"><h3 className="text-xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{text}</p></div>;
}
