import { useEffect, useMemo, useState } from "react";
import { Building2, PackagePlus, Save, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";

export function AdminSuppliersPanel(){
  const [operations,setOperations]=useState<any>({suppliers:[],purchases:[]});
  const [products,setProducts]=useState<any[]>([]);
  const [form,setForm]=useState({name:"",email:"",phone:"",category:""});
  const [purchase,setPurchase]=useState({supplierId:"",reference:"",productId:"",quantity:1,unitCost:0});

  const load=async()=>{
    try{
      const [r]=await Promise.all([backendApi.getPosOperations(),backendStorage.refresh()]);
      setOperations(r.operations||{});
      try{setProducts(JSON.parse(backendStorage.getItem("adminProducts")||"[]").filter((p:any)=>p.active!==false&&!p.deletedAt));}catch{setProducts([]);}
    }catch(e:any){toast.error(e?.message||"No se pudieron cargar proveedores");}
  };
  useEffect(()=>{void load();},[]);

  const add=async()=>{
    if(!form.name.trim()) return toast.error("Escribe el nombre del proveedor");
    try{
      const r=await backendApi.savePosSupplier(form);
      setOperations(r.operations||operations);
      setForm({name:"",email:"",phone:"",category:""});
      toast.success("Proveedor guardado");
    }catch(e:any){toast.error(e?.message||"No se pudo guardar");}
  };

  const createPurchase=async()=>{
    if(!purchase.supplierId||!purchase.productId||purchase.quantity<=0)return toast.error("Selecciona proveedor, producto y cantidad");
    try{
      const r=await backendApi.createPosPurchase({
        supplierId:purchase.supplierId,
        reference:purchase.reference,
        items:[{id:purchase.productId,quantity:purchase.quantity,unitCost:purchase.unitCost}],
      });
      setOperations(r.operations||operations);
      setProducts(r.inventory||products);
      await backendStorage.refresh();
      setPurchase({...purchase,reference:"",productId:"",quantity:1,unitCost:0});
      toast.success("Compra registrada y stock actualizado");
    }catch(e:any){toast.error(e?.message||"No se pudo registrar la compra");}
  };

  const spent=useMemo(()=>(operations.purchases||[]).reduce((s:number,p:any)=>s+Number(p.total||0),0),[operations]);
  const selectedProduct=products.find((p:any)=>String(p.id)===String(purchase.productId));

  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-card p-6"><p className="text-sm font-bold uppercase tracking-wider text-primary">Compras y proveedores</p><h1 className="mt-2 text-3xl font-black">Proveedores Herencia</h1><p className="mt-2 text-muted-foreground">Altas, compras y entradas de stock conectadas al TPV.</p></section>
    <div className="grid gap-4 md:grid-cols-3"><Card icon={Building2} label="Proveedores" value={String((operations.suppliers||[]).length)}/><Card icon={Truck} label="Compras registradas" value={String((operations.purchases||[]).length)}/><Card icon={PackagePlus} label="Compras acumuladas" value={new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(spent)}/></div>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Nuevo proveedor</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{(["name","email","phone","category"] as const).map((key)=><input key={key} value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})} placeholder={{name:"Nombre",email:"Email",phone:"Teléfono",category:"Categoría"}[key]} className="rounded-xl border border-border bg-background p-3"/>)}</div><button onClick={()=>void add()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><Save className="h-4 w-4"/>Guardar proveedor</button></section>

      <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Registrar compra / entrada</h2><p className="mt-1 text-sm text-muted-foreground">La cantidad se suma al stock real. Si el producto estaba agotado, dispara el aviso de reposición.</p><div className="mt-4 grid gap-3">
        <select value={purchase.supplierId} onChange={(e)=>setPurchase({...purchase,supplierId:e.target.value})} className="rounded-xl border border-border bg-background p-3"><option value="">Proveedor</option>{(operations.suppliers||[]).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select value={purchase.productId} onChange={(e)=>setPurchase({...purchase,productId:e.target.value})} className="rounded-xl border border-border bg-background p-3"><option value="">Producto</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.name} · stock {p.stock||0}</option>)}</select>
        <div className="grid grid-cols-2 gap-3"><input type="number" min="1" value={purchase.quantity} onChange={(e)=>setPurchase({...purchase,quantity:Math.max(1,Number(e.target.value||1))})} placeholder="Cantidad" className="rounded-xl border border-border bg-background p-3"/><input type="number" min="0" step="0.01" value={purchase.unitCost} onChange={(e)=>setPurchase({...purchase,unitCost:Math.max(0,Number(e.target.value||0))})} placeholder="Coste unidad" className="rounded-xl border border-border bg-background p-3"/></div>
        <input value={purchase.reference} onChange={(e)=>setPurchase({...purchase,reference:e.target.value})} placeholder="Referencia / factura proveedor" className="rounded-xl border border-border bg-background p-3"/>
        {selectedProduct&&<p className="text-sm text-muted-foreground">Después de esta entrada: <strong>{Number(selectedProduct.stock||0)+purchase.quantity}</strong> uds. · Coste entrada: <strong>{new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(purchase.quantity*purchase.unitCost)}</strong></p>}
      </div><button onClick={()=>void createPurchase()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><ShoppingBag className="h-4 w-4"/>Registrar compra</button></section>
    </div>

    <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold mb-4">Proveedores registrados</h2><div className="space-y-2">{(operations.suppliers||[]).length===0?<p className="text-sm text-muted-foreground">Aún no hay proveedores.</p>:(operations.suppliers||[]).map((s:any)=><div key={s.id||s.name} className="rounded-xl border border-border p-4"><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.category||"Sin categoría"} · {s.email||"Sin email"} · {s.phone||"Sin teléfono"}</p></div>)}</div></section>

    <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold mb-4">Últimas compras</h2><div className="space-y-2">{(operations.purchases||[]).length===0?<p className="text-sm text-muted-foreground">Sin compras registradas.</p>:(operations.purchases||[]).slice(0,30).map((p:any)=><div key={p.id} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{p.reference||"Compra a proveedor"}</p><p className="text-xs text-muted-foreground">{(p.items||[]).map((i:any)=>`${i.name} x${i.quantity}`).join(", ")} · {new Date(p.createdAt).toLocaleString("es-ES")}</p></div><strong>{new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(p.total||0))}</strong></div>)}</div></section>
  </div>;
}
function Card({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-2xl border border-border bg-card p-5"><Icon className="h-6 w-6 text-primary"/><p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>}
