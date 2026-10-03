import { useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, Server, CreditCard, Brain, ShoppingBag } from "lucide-react";
import { backendApi } from "../../lib/backendStorage";
type Check={name:string;ok:boolean;detail:string};
export function AdminSystemAudit(){
 const [running,setRunning]=useState(false),[checks,setChecks]=useState<Check[]>([]),[ranAt,setRanAt]=useState("");
 const run=async()=>{setRunning(true);const out:Check[]=[];
  try{const h=await backendApi.health();out.push({name:"Backend / Railway",ok:!!h.ok,detail:h.ok?"API responde correctamente":"API sin respuesta válida"});}catch(e:any){out.push({name:"Backend / Railway",ok:false,detail:e?.message||"Sin conexión"});}
  try{
    const r=await backendApi.readiness();
    out.push({name:"Base de datos primaria",ok:!!r.database,detail:r.database?`Operativa · ${r.databaseProvider||r.databasePrimary||"proveedor configurado"}`:"No disponible"});
    out.push({name:"Stripe backend",ok:!!r.stripe,detail:r.stripe?"Clave servidor configurada":"Stripe no está configurado"});
    out.push({name:"Webhook Stripe",ok:!!r.stripeWebhook,detail:r.stripeWebhook?"Webhook de pagos configurado":"Falta STRIPE_WEBHOOK_SECRET"});
    out.push({name:"Email transaccional",ok:!!r.email,detail:r.email?"Resend configurado":"Falta proveedor de email"});
    out.push({name:"Google Maps / reparto",ok:!!r.maps,detail:r.maps?"Cálculo de distancia configurado":"Falta clave de Google Maps"});
    out.push({name:"IA de ventas",ok:!!r.salesAi,detail:r.salesAi?"Groq configurado en servidor":"Falta GROQ_API_KEY"});
    out.push({name:"IA de imágenes",ok:!!r.imageAi,detail:r.imageAi?"Proveedor de imagen configurado":"Falta Gemini o Nano Banana"});
  }catch(e:any){out.push({name:"Readiness del backend",ok:false,detail:e?.message||"No disponible"});}
  try{
    const [commerce,catalog]=await Promise.all([backendApi.commerceHealth(),backendApi.listCommerceProducts({includeArchived:true})]);
    const products=Array.isArray(catalog?.products)?catalog.products:[];
    const active=products.filter((p:any)=>p?.active!==false&&!p?.deletedAt&&String(p?.status||"active")!=="archived");
    const sellable=active.filter((p:any)=>p?.trackInventory===false||Number(p?.stock||0)>0||(Array.isArray(p?.variants)&&p.variants.some((v:any)=>Number(v?.stock||0)>0)));
    out.push({name:"Commerce Core",ok:commerce?.ok!==false,detail:`${commerce?.products||0} productos · ${commerce?.collections||0} colecciones · ${commerce?.source||"sin fuente"}`});
    out.push({name:"Catálogo vendible",ok:sellable.length>0,detail:`${active.length} activos · ${sellable.length} con disponibilidad de venta`});
  }catch(e:any){out.push({name:"Commerce Core",ok:false,detail:e?.message||"No accesible"});}
  try{
    const media=await backendApi.siteMediaStatus();
    const ready=media.provider==="cloudflare_r2"&&media.configured&&media.connection?.ok!==false;
    out.push({name:"Biblioteca multimedia",ok:ready,detail:ready?"Cloudflare R2 operativo · lectura/escritura comprobadas":(media.connection?.error||"R2 pendiente o sin acceso de escritura")});
  }catch(e:any){out.push({name:"Biblioteca multimedia",ok:false,detail:e?.message||"No se pudo comprobar"});}
  try{const p=await backendApi.posSelfTest();out.push(...(p.tests||[]).map((t:any)=>({name:"TPV · "+t.name,ok:!!t.ok,detail:t.detail})));out.push({name:"Stripe / tarjeta TPV",ok:!!p.cardReady,detail:p.cardReady?"Configuración disponible":"Falta configuración o validación"});out.push({name:"Datos fiscales",ok:!!p.fiscalReady,detail:p.fiscalReady?"Datos del emisor configurados":"Completa los datos fiscales del emisor"});}catch(e:any){out.push({name:"TPV",ok:false,detail:e?.message||"No se pudo ejecutar el autotest"});}
  try{const n=await backendApi.neuralSelfTest();out.push({name:"HERENCIA Neural",ok:n?.ok!==false,detail:n?.ok===false?(n?.error||"Autotest con incidencias"):"Core Neural responde"});}catch(e:any){out.push({name:"HERENCIA Neural",ok:false,detail:e?.message||"Sin respuesta"});}
  try{const s=await backendApi.adminSession();out.push({name:"Sesión de Administración",ok:!!s.authenticated,detail:s.authenticated?"Cookie de sesión válida en este navegador":"La sesión no está autenticada"});}catch(e:any){out.push({name:"Sesión de Administración",ok:false,detail:e?.message||"No se pudo validar la sesión"});}
  try{const o=await backendApi.listOrders();out.push({name:"Pedidos",ok:Array.isArray(o.orders),detail:Array.isArray(o.orders)?o.orders.length+" pedidos accesibles desde la base primaria":"Respuesta inválida"});}catch(e:any){out.push({name:"Pedidos",ok:false,detail:e?.message||"No accesible"});}
  out.push({name:"PWA / Service Worker",ok:"serviceWorker" in navigator,detail:"serviceWorker" in navigator?"Navegador compatible con instalación offline":"Navegador sin Service Worker"});
  out.push({name:"Notificaciones navegador",ok:typeof Notification!=="undefined",detail:typeof Notification!=="undefined"?`Soportadas · permiso: ${Notification.permission}`:"No compatibles"});
  setChecks(out);setRanAt(new Date().toLocaleString("es-ES"));setRunning(false);
 };
 const ok=checks.filter(c=>c.ok).length;
 return <div className="space-y-6"><section className="rounded-[2rem] border bg-white p-6 shadow-xl"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h1 className="text-3xl font-black">Diagnóstico de producción</h1><p className="mt-2 text-zinc-500">Comprueba servicios reales sin crear pedidos ni efectuar cobros.</p></div><button onClick={run} disabled={running} className="rounded-2xl bg-zinc-950 px-5 py-3 font-black text-white disabled:opacity-50"><RefreshCw className={"mr-2 inline h-4 w-4 "+(running?"animate-spin":"")}/>Ejecutar diagnóstico</button></div>{checks.length>0&&<div className="mt-5 rounded-2xl bg-zinc-50 p-4 font-bold">{ok}/{checks.length} comprobaciones correctas · {ranAt}</div>}</section><div className="grid gap-4 md:grid-cols-2">{checks.map((c,i)=><div key={i} className={"rounded-3xl border p-5 "+(c.ok?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50")}><div className="flex gap-3">{c.ok?<CheckCircle2 className="text-emerald-600"/>:<AlertTriangle className="text-amber-600"/>}<div><h3 className="font-black">{c.name}</h3><p className="mt-1 text-sm text-zinc-600">{c.detail}</p></div></div></div>)}</div>{!checks.length&&<div className="rounded-3xl border border-dashed p-10 text-center text-zinc-500"><Server className="mx-auto mb-3"/><p>Ejecuta el diagnóstico para comprobar backend, TPV, pagos, pedidos y Neural.</p><div className="mt-4 flex justify-center gap-4 text-zinc-400"><CreditCard/><ShoppingBag/><Brain/></div></div>}</div>;
}