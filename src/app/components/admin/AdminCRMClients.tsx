import { useEffect, useMemo, useState } from "react";
import { Mail, ShoppingBag, Star, UserRound } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

function money(value:number){ return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(value||0); }

export function AdminCRMClients(){
  const [orders,setOrders]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    backendApi.listOrders()
      .then((r)=>setOrders(r.orders||[]))
      .catch((e)=>toast.error(e?.message||"No se pudieron cargar los clientes"))
      .finally(()=>setLoading(false));
  },[]);

  const customers=useMemo(()=>{
    const map=new Map<string,any>();
    for(const order of orders){
      const email=String(order.customerEmail||"").trim().toLowerCase();
      const key=email || String(order.customerName||"Cliente").trim().toLowerCase();
      if(!key) continue;
      const current=map.get(key)||{name:order.customerName||"Cliente",email,orders:0,totalSpent:0,lastOrder:null,items:new Map<string,number>()};
      current.orders+=1;
      if(["paid","confirmed","preparing","ready","delivered","completed"].includes(order.status)) current.totalSpent+=Number(order.total||0);
      if(!current.lastOrder || new Date(order.date)>new Date(current.lastOrder)) current.lastOrder=order.date;
      for(const item of order.items||[]) current.items.set(item.name,(current.items.get(item.name)||0)+Number(item.quantity||1));
      map.set(key,current);
    }
    return [...map.values()].map((c:any)=>({
      ...c,
      favorite:[...c.items.entries()].sort((a:any,b:any)=>b[1]-a[1])[0]?.[0]||"Sin datos",
      level:c.totalSpent>=300?"Jardín":c.totalSpent>=100?"Brote":"Semilla",
    })).sort((a:any,b:any)=>b.totalSpent-a.totalSpent);
  },[orders]);

  if(loading) return <div className="py-16 text-center text-muted-foreground">Cargando CRM…</div>;

  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-sm font-bold uppercase tracking-wider text-primary">CRM conectado a pedidos</p><h1 className="mt-2 text-3xl font-black">Clientes Herencia</h1><p className="mt-2 text-muted-foreground">Historial, gasto real, frecuencia y producto más comprado.</p></div>
        <div className="rounded-2xl bg-primary/10 px-5 py-4"><p className="text-sm font-semibold text-muted-foreground">Clientes detectados</p><p className="text-4xl font-black text-primary">{customers.length}</p></div>
      </div>
    </section>
    {customers.length===0 ? <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">Aún no hay clientes con pedidos.</div> :
    <div className="grid gap-4 xl:grid-cols-2">{customers.map((c:any,i:number)=><section key={c.email||c.name} className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10"><UserRound className="h-6 w-6 text-primary"/></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{c.name}</h2><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{c.level}</span></div>{c.email&&<p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5"/>{c.email}</p>}</div></div><div className="text-right"><p className="text-xs text-muted-foreground">Gastado</p><p className="text-xl font-black text-primary">{money(c.totalSpent)}</p></div></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm"><Metric icon={ShoppingBag} label="Pedidos" value={String(c.orders)}/><Metric icon={Star} label="Favorito" value={c.favorite}/><Metric icon={ShoppingBag} label="Última compra" value={c.lastOrder?new Date(c.lastOrder).toLocaleDateString("es-ES"):"—"}/></div>
    </section>)}</div>}
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-xl bg-muted/40 p-3"><div className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5"/>{label}</div><p className="mt-1 truncate font-semibold">{value}</p></div>}
