import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type DeliveryOrder={id:string;customerName?:string;deliveryMethod?:string;status?:string;date?:string;metadata?:any};
const statuses=["confirmed","preparing","ready","out_for_delivery","delivered"];
const labels:Record<string,string>={confirmed:"Confirmado",preparing:"Preparando",ready:"Listo",out_for_delivery:"En reparto",delivered:"Entregado"};
function addressOf(order:DeliveryOrder){const a=order.metadata?.shippingAddress||order.metadata?.address||{};return [a.address||a.street,a.postalCode||a.zip,a.city,a.province].filter(Boolean).join(", ");}
export function AdminDeliveryPanel(){
 const [orders,setOrders]=useState<DeliveryOrder[]>([]);const [loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const r=await backendApi.listOrders();setOrders((Array.isArray(r.orders)?r.orders:[]).filter((o:any)=>(o.deliveryMethod||o.delivery_method)!=="recoger"));}catch(e:any){toast.error(e?.message||"No se pudieron cargar las entregas");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const active=useMemo(()=>orders.filter(o=>!["delivered","completed","cancelled"].includes(o.status||"")).length,[orders]);
 const update=async(order:DeliveryOrder,status:string)=>{try{await backendApi.updateOrderStatus(order.id,status);setOrders(rows=>rows.map(o=>o.id===order.id?{...o,status}:o));toast.success("Estado de entrega actualizado");}catch(e:any){toast.error(e?.message||"No se pudo actualizar");}};
 return <div className="space-y-6">
  <section className="rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="mb-2 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">Reparto conectado a pedidos reales</div><h1 className="text-4xl font-black">Entregas Herencia</h1><p className="mt-2 text-zinc-500">Sin datos de demostración: aparecen los pedidos reales con envío.</p></div><div className="flex items-center gap-3"><div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 px-6 py-4"><p className="text-sm font-bold text-zinc-500">Activos</p><p className="text-4xl font-black text-emerald-700">{active}</p></div><button onClick={load} className="rounded-2xl border p-4" title="Actualizar"><RefreshCw className={loading?"animate-spin":""}/></button></div></div></section>
  <section className="rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl"><div className="mb-5 flex items-center gap-3"><Truck className="text-emerald-700"/><div><h2 className="text-2xl font-black">Pedidos de reparto</h2><p className="text-sm text-zinc-500">Dirección y estado sincronizados con Pedidos.</p></div></div><div className="space-y-4">
   {!loading&&!orders.length&&<div className="rounded-3xl border border-dashed p-10 text-center text-zinc-500">No hay pedidos con entrega a domicilio.</div>}
   {orders.map(order=>{const address=addressOf(order);return <div key={order.id} className="rounded-3xl border border-emerald-100 bg-emerald-50/30 p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="text-xs font-black text-emerald-700">PEDIDO #{order.id}</div><h3 className="mt-1 text-xl font-black">{order.customerName||"Cliente"}</h3><div className="mt-2 flex items-center gap-2 text-sm text-zinc-500"><MapPin className="h-4 w-4"/><span>{address||"Dirección no indicada"}</span></div><div className="mt-2 flex items-center gap-2 text-sm text-zinc-500"><Clock3 className="h-4 w-4"/><span>{order.date?new Date(order.date).toLocaleString("es-ES"):"Sin fecha"}</span></div></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white px-3 py-2 text-xs font-black"><PackageCheck className="mr-1 inline h-4 w-4"/>{labels[order.status||""]||order.status||"Pendiente"}</span><select value={order.status||""} onChange={e=>void update(order,e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold"><option value="">Estado</option>{statuses.map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></div></div></div>})}
  </div></section>
 </div>;
}