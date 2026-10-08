import { useEffect, useState } from "react";
import { Truck, Save, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";
import { parseShippingSettings, shippingQuoteForCart, validateShippingSettings } from "../../../../backend/shippingPolicy.js";

const sectors = [
  ["plantas","Plantas"],["semillas","Semillas"],["jardineria","Jardinería"],
  ["tierra-y-sustratos","Tierra y sustratos"],["decoracion","Decoración"],
  ["dulce","Dulce"],["moda","Moda"]
];
const inputStyle = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const labelStyle = "text-xs font-semibold text-muted-foreground";
const currency = (n: number) => Number(n || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
type Rule = { shippingEnabled?: boolean; freeShipping?: boolean };
type ShippingSettings = ReturnType<typeof parseShippingSettings>;

export function AdminShippingRules() {
  const [policy,setPolicy] = useState<ShippingSettings>(() => parseShippingSettings(backendStorage.getItem("shippingSettings")));
  const [saving,setSaving] = useState(false);
  const [productId,setProductId] = useState("");
  const [previewKm,setPreviewKm] = useState(6);
  const [previewAmount,setPreviewAmount] = useState(35);
  const [previewCategory,setPreviewCategory] = useState("plantas");
  const [previewResult,setPreviewResult] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setPolicy(parseShippingSettings(backendStorage.getItem("shippingSettings")));
    window.addEventListener("backend-storage",refresh);
    return () => window.removeEventListener("backend-storage",refresh);
  }, []);
  const patch = (key: string,value: unknown) => setPolicy((old: any) => ({...old,[key]:value}));
  const patchFree = (key: string,value: unknown) => setPolicy((old: any) => ({...old,free:{...old.free,[key]:value}}));
  const setRule = (section: "categories" | "products",id:string, field:keyof Rule,value:boolean | undefined) =>
    setPolicy((old: any) => ({...old,[section]:{...old[section],[id]:{...old[section]?.[id],[field]:value}}}));
  async function save() {
    try {
      const checked = validateShippingSettings({...policy,advancedEnabled:true});
      setSaving(true);
      const result = await backendStorage.setItem("shippingSettings",JSON.stringify(checked));
      if (!result.ok || !result.synced) throw new Error(result.error || "El servidor no confirmó el guardado");
      setPolicy(checked);
      toast.success("Reglas de envío guardadas en el servidor");
    } catch(error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los envíos");
    } finally { setSaving(false); }
  }
  function preview() {
    try {
      const charge = shippingQuoteForCart({
        settings:{...policy,advancedEnabled:true},
        lines:[{id:"producto-demo",category:previewCategory,price:previewAmount,quantity:1,type:"product"}],
        distanceKm:previewKm,legacyPrice:5
      });
      setPreviewResult("Transporte simulado: " + currency(charge) + ". No se generó ningún pedido ni cargo.");
    } catch(error) { setPreviewResult(error instanceof Error ? error.message : "No se pudo simular"); }
  }
  const toggle = (label:string,on:boolean,change:(v:boolean)=>void) => (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3 text-sm">
      <span className="font-medium">{label}</span>
      <input type="checkbox" checked={on} onChange={e=>change(e.target.checked)} className="h-5 w-5 accent-emerald-700" />
    </label>
  );
  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-5" aria-label="Reglas de envío">
      <div className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /><h3 className="text-xl font-bold">Envíos y dropshipping</h3></div>
      <p className="text-xs text-muted-foreground">Precios y promociones configurables para productos físicos. Los servicios conservan su reserva sin envío. Los gastos CJ ya incluidos en el precio de venta no se cobran dos veces.</p>
      {toggle("Cobrar gastos de envío (ON/OFF)",policy.enabled,v=>patch("enabled",v))}
      <p className="text-xs text-amber-700">OFF elimina la tarifa de transporte, pero no la obligación de entregar los artículos ni la tarifa que el proveedor cobre a Herencia.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelStyle}>Tipo de tarifa
          <select className={inputStyle} value={policy.mode} onChange={e=>patch("mode",e.target.value)}>
            <option value="distance">Google Maps · cada X kilómetros</option>
            <option value="tiers">Tramos desde/hasta</option>
            <option value="fixed">Precio fijo</option>
          </select>
        </label>
        {(["basePrice","minimum","maximum"] as const).map(field => (
          <label key={field} className={labelStyle}>{field==="basePrice"?"Tarifa base (€)":field==="minimum"?"Precio mínimo (€)":"Precio máximo (€)"}
            <input className={inputStyle} type="number" step="0.01" min="0" value={policy[field]} onChange={e=>patch(field,Number(e.target.value))} />
          </label>
        ))}
        {policy.mode==="distance" && (["blockKm","blockPrice"] as const).map(field=>(
          <label key={field} className={labelStyle}>{field==="blockKm"?"Cada cuántos kilómetros":"Coste por tramo (€)"}
            <input className={inputStyle} type="number" step={field==="blockKm"?"1":"0.01"} min="0" value={policy[field]} onChange={e=>patch(field,Number(e.target.value))} />
          </label>
        ))}
      </div>
      {policy.mode==="tiers" && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Tramos de distancia (kilómetros desde 0 hasta el límite)</h4>
          {(policy.tiers || []).map((tier:any,index:number)=>(
            <div className="flex gap-2" key={index}>
              <label className={labelStyle}>Hasta km
                <input className={inputStyle} type="number" min="0.1" step="0.1" value={tier.maxKm} onChange={e=>patch("tiers",policy.tiers.map((t:any,i:number)=>i===index?{...t,maxKm:Number(e.target.value)}:t))}/>
              </label>
              <label className={labelStyle}>Coste €
                <input className={inputStyle} type="number" min="0" step="0.01" value={tier.price} onChange={e=>patch("tiers",policy.tiers.map((t:any,i:number)=>i===index?{...t,price:Number(e.target.value)}:t))}/>
              </label>
              <button type="button" aria-label="Eliminar tramo" className="text-red-600" onClick={()=>patch("tiers",policy.tiers.filter((_:any,i:number)=>i!==index))}>Quitar</button>
            </div>
          ))}
          <button type="button" className="rounded-xl border border-border px-3 py-2 text-sm" onClick={()=>patch("tiers",[...policy.tiers,{maxKm:(policy.tiers.at(-1)?.maxKm||0)+3,price:policy.basePrice}])}>+ Añadir tramo</button>
        </div>
      )}
      <div className="space-y-3 rounded-xl border border-border p-4">
        {toggle("Permitir envío gratuito",policy.free.enabled,v=>patchFree("enabled",v))}
        {policy.free.enabled && <>
          <label className={labelStyle}>Aplicar a
            <select className={inputStyle} value={policy.free.scope} onChange={e=>patchFree("scope",e.target.value)}>
              <option value="all">Toda la tienda (productos físicos)</option>
              <option value="categories">Categorías seleccionadas</option>
              <option value="products">Productos seleccionados</option>
              <option value="none">Ninguno</option>
            </select>
          </label>
          <label className={labelStyle}>Importe mínimo de artículos elegibles (€; 0 = sin mínimo)
            <input className={inputStyle} type="number" min="0" step="0.01" value={policy.free.threshold} onChange={e=>patchFree("threshold",Number(e.target.value))}/>
          </label>
          {policy.free.scope==="products" && <label className={labelStyle}>IDs de productos con envío gratis (separados por comas)
            <input className={inputStyle} value={policy.free.products.join(", ")} onChange={e=>patchFree("products",e.target.value.split(",").map(x=>x.trim()).filter(Boolean))}/>
          </label>}
        </>}
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Control por categorías</h4>
        <p className="text-xs text-muted-foreground">Selecciona gratis o sin gastos de envío por sector. Las excepciones individuales prevalecen.</p>
        {sectors.map(([id,title])=>(
          <div key={id} className="grid grid-cols-1 items-center gap-2 rounded-lg bg-muted/30 p-2 sm:grid-cols-3">
            <span className="text-sm">{title}</span>
            <label className="text-xs">Tarifa
              <select className={inputStyle} value={policy.categories[id]?.shippingEnabled===false?"off":"on"} onChange={e=>setRule("categories",id,"shippingEnabled",e.target.value==="on")}>
                <option value="on">ON</option><option value="off">OFF</option>
              </select>
            </label>
            <label className="text-xs">Envío gratis
              <select className={inputStyle} value={policy.categories[id]?.freeShipping===true?"yes":policy.free.categories.includes(id)?"scope":"inherit"} onChange={e=>{
                setRule("categories",id,"freeShipping",e.target.value==="yes"?true:undefined);
                patchFree("categories",e.target.value==="scope"?[...new Set([...policy.free.categories,id])]:policy.free.categories.filter((c:string)=>c!==id));
              }}>
                <option value="inherit">Según regla general</option><option value="yes">Siempre gratis</option>
                <option value="scope">Incluir en promoción</option>
              </select>
            </label>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Excepciones por producto</h4>
        <div className="flex gap-2">
          <input className={inputStyle} placeholder="ID del producto del catálogo" value={productId} onChange={e=>setProductId(e.target.value)}/>
          <button type="button" className="rounded-xl border px-3 text-sm" onClick={()=>{if(productId.trim()) {setRule("products",productId.trim().toLowerCase(),"shippingEnabled",true);setProductId("");}}}>Añadir</button>
        </div>
        {Object.keys(policy.products).map(id=><div key={id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="min-w-28 truncate">{id}</span>
          <label><input type="checkbox" checked={policy.products[id]?.shippingEnabled!==false} onChange={e=>setRule("products",id,"shippingEnabled",e.target.checked)}/> Cobrar envío</label>
          <label><input type="checkbox" checked={policy.products[id]?.freeShipping===true} onChange={e=>setRule("products",id,"freeShipping",e.target.checked?true:undefined)}/> Gratis</label>
          <button type="button" className="text-red-600" onClick={()=>setPolicy((old:any)=>{const products={...old.products};delete products[id];return {...old,products};})}>Eliminar</button>
        </div>)}
      </div>
      <div className="rounded-xl bg-muted/40 p-4 space-y-3">
        <div className="flex items-center gap-2"><FlaskConical className="h-4 w-4"/><h4 className="font-semibold text-sm">Simulador (sin pagos ni pedidos)</h4></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={labelStyle}>Kilómetros<input type="number" className={inputStyle} min="0" value={previewKm} onChange={e=>setPreviewKm(Number(e.target.value))}/></label>
          <label className={labelStyle}>Importe del producto (€)<input type="number" className={inputStyle} min="0" value={previewAmount} onChange={e=>setPreviewAmount(Number(e.target.value))}/></label>
          <label className={labelStyle}>Sector<select className={inputStyle} value={previewCategory} onChange={e=>setPreviewCategory(e.target.value)}>{sectors.map(([id,t])=><option key={id} value={id}>{t}</option>)}</select></label>
        </div>
        <button type="button" className="rounded-xl border border-border px-3 py-2 text-sm" onClick={preview}>Simular envío</button>
        {previewResult && <p role="status" className="text-sm">{previewResult}</p>}
      </div>
      <button type="button" disabled={saving} onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"Guardando…":"Guardar reglas de envío"}</button>
      <p className="text-xs text-muted-foreground">CJdropshipping: su transporte se valida con el proveedor y está incluido en el precio del producto. No se añade una segunda tarifa al cliente. El simulador no envía pedidos reales.</p>
    </section>
  );
}
