import { useEffect, useState } from "react";

type ProviderStatus = {configured:boolean,missing?:string[]};
type Method = {id:number,name:string,carrier:string};
type Point = {id:number,name:string,carrier:string,street:string,houseNumber:string,postalCode:string,city:string};

export function AdminSendcloudPanel() {
  const [status,setStatus] = useState<ProviderStatus | null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [methods,setMethods] = useState<Method[]>([]);
  const [points,setPoints] = useState<Point[]>([]);
  const [postalCode,setPostalCode] = useState("08032");
  useEffect(()=>{
    let active=true;
    fetch("/api/admin/shipping/sendcloud/status",{credentials:"include"})
      .then(async r=>{if(!r.ok)throw Error("No se pudo consultar Railway");return r.json();})
      .then(data=>{if(active)setStatus(data);})
      .catch(()=>{if(active)setStatus({configured:false,missing:["Comprobar servidor de pruebas"]});});
    return ()=>{active=false;};
  },[]);
  async function call(path:string,body:any={}) {
    const response = await fetch("/api/admin/shipping/sendcloud/"+path,{
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Sendcloud no respondió");
    return data;
  }
  async function action(which:"test"|"methods"|"points"){
    setBusy(true);setMessage("");
    try{
      const data=await call(which,which==="points"?{postalCode}:{});
      if(which==="test"){
        setMessage(data.connected? "Claves válidas. Sendcloud respondió correctamente.": "La cuenta no confirmó la conexión.");
      }else if(which==="methods"){
        setMethods(data.methods||[]);
        setMessage((data.methods||[]).length+" métodos devueltos por Sendcloud. No son todavía tarifas para cobrar.");
      }else{
        setPoints(data.points||[]);
        setMessage((data.points||[]).length+" puntos encontrados para el código postal indicado.");
      }
    }catch(error:any){setMessage(error.message||"Error al consultar Sendcloud");}
    finally{setBusy(false);}
  }
  return <section className="space-y-4 rounded-3xl border border-[#e2e6de] bg-white p-5 shadow-sm">
    <h3 className="text-lg font-bold">Sendcloud · Conexión API</h3>
    <p className="text-sm text-muted-foreground">Esta conexión se utiliza exclusivamente desde el backend Railway. No se compra ninguna etiqueta desde esta pantalla.</p>
    <div className="rounded-xl bg-[#f5f7f4] p-3 text-sm">
      <strong>Credenciales Railway:</strong>{" "}
      {status===null ? "Comprobando..." : status.configured ? "Detectadas" : "Faltan variables"}
      {status?.missing?.length ? <p className="mt-1 text-xs text-amber-800">{status.missing.join(", ")}</p> : null}
      <p className="mt-2 text-xs">Variables: <code>SENDCLOUD_PUBLIC_KEY</code> y <code>SENDCLOUD_SECRET_KEY</code>. Nunca introduzcas las claves aquí ni en el frontend.</p>
    </div>
    <p className="text-sm text-muted-foreground">En Sendcloud configura una dirección de remitente, activa los transportistas y habilita los puntos de servicio. Para comprar etiquetas también será necesario un método de pago en Sendcloud.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy||!status?.configured} onClick={()=>action("test")}
        className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-40">Probar API</button>
      <button type="button" disabled={busy||!status?.configured} onClick={()=>action("methods")}
        className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-40">Ver transportistas</button>
    </div>
    {methods.length>0 && <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2">
      {methods.map(m=><p className="text-sm" key={m.id}>{m.carrier || "Transportista"} · {m.name} (ID {m.id})</p>)}
    </div>}
    <label className="block space-y-1 text-sm font-semibold">
      <span>Buscar puntos de recogida cerca de este código postal</span>
      <input value={postalCode} maxLength={5} inputMode="numeric" onChange={e=>setPostalCode(e.target.value)}
        className="w-full rounded-xl border p-3 font-normal" placeholder="08032"/>
    </label>
    <button type="button" disabled={busy||!status?.configured||!/^\d{5}$/.test(postalCode)} onClick={()=>action("points")}
      className="rounded-full bg-[#315b42] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
      {busy?"Consultando...":"Ver puntos de recogida"}
    </button>
    {points.length>0 && <div className="max-h-64 space-y-2 overflow-y-auto">
      {points.map(p=><div className="rounded-xl border p-3 text-sm" key={p.id}>
        <strong>{p.name}</strong> · {p.carrier}<p className="text-muted-foreground">{p.street} {p.houseNumber}, {p.postalCode} {p.city}</p>
      </div>)}
    </div>}
    {message && <p role="status" className="rounded-xl bg-[#f1f5ef] p-3 text-sm">{message}</p>}
    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
      Sendcloud excluye las plantas de la cobertura ordinaria por pérdida o daño; el transportista puede imponer restricciones adicionales. No activar plantas vivas sin confirmación expresa del servicio.
      Las tarifas y etiquetas del checkout siguen desactivadas hasta verificarlas.
    </p>
  </section>;
}
