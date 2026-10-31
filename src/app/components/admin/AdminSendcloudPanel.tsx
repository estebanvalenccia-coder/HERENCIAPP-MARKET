import { useEffect, useState } from "react";

type ProviderStatus = {configured:boolean,missing?:string[]};
type Quote = {code:string,name:string,carrier:string,price:number|null,currency:string|null};
type Point = {id:number,name:string,carrier:string,street:string,houseNumber:string,postalCode:string,city:string};

export function AdminSendcloudPanel() {
  const [status,setStatus] = useState<ProviderStatus | null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [methods,setMethods] = useState<Quote[]>([]);
  const [points,setPoints] = useState<Point[]>([]);
  const [postalCode,setPostalCode] = useState("28001");
  const [originZip,setOriginZip] = useState("08032");
  const [weight,setWeight] = useState("0.5");
  const [length,setLength] = useState("20");
  const [width,setWidth] = useState("15");
  const [height,setHeight] = useState("10");
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
  async function action(which:"test"|"quotes"|"points"){
    setBusy(true);setMessage("");
    try{
      const data=await call(which,which==="points"?{postalCode}:which==="quotes"?{fromZip:originZip,toZip:postalCode,parcel:{weight:Number(weight),length:Number(length),width:Number(width),height:Number(height)}}:{});
      if(which==="test"){
        setMessage(data.connected? "Claves válidas. Sendcloud respondió correctamente.": "La cuenta no confirmó la conexión.");
      }else if(which==="quotes"){
        setMethods(data.quotes||[]);
        setMessage((data.quotes||[]).length+" servicios consultados con la API v3 de Sendcloud.");
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

    </div>
    <div className="rounded-2xl border p-3 space-y-3">
      <p className="text-sm font-bold">Consultar tarifas reales (Sendcloud API v3)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["Origen CP",originZip,setOriginZip],["Destino CP",postalCode,setPostalCode],
          ["Peso kg",weight,setWeight],["Largo cm",length,setLength],
          ["Ancho cm",width,setWidth],["Alto cm",height,setHeight],
        ].map(([name,value,setter])=><label className="text-xs font-semibold" key={String(name)}>
          {String(name)}<input className="mt-1 w-full rounded-lg border p-2 font-normal"
          value={value as string} onChange={e=>(setter as (s:string)=>void)(e.target.value)} />
        </label>)}
      </div>
      <button type="button" disabled={busy||!status?.configured||!/^\d{5}$/.test(originZip)||!/^\d{5}$/.test(postalCode)}
        onClick={()=>action("quotes")} className="rounded-xl bg-[#315b42] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
        Consultar transportistas y precios
      </button>
      {methods.length>0 && <div className="max-h-64 space-y-2 overflow-y-auto">
        {methods.map(m=><div className="rounded-xl border p-2 text-sm" key={m.code}>
          <strong>{m.carrier||"Transportista"}</strong> · {m.name||m.code}
          <span className="ml-2 font-bold">{m.price===null?"Precio no disponible":m.price.toFixed(2)+" €"}</span>
        </div>)}
      </div>}
      <p className="text-xs text-amber-800">Consulta de prueba: no contrata envíos. No activar el cobro hasta validar la respuesta de precios y los artículos permitidos.</p>
    </div>
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
