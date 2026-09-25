import { useEffect, useMemo, useState } from "react";
import { Building2, PackagePlus, Save, Truck } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

export function AdminSuppliersPanel(){
  const [operations,setOperations]=useState<any>({suppliers:[],purchases:[]});
  const [form,setForm]=useState({name:"",email:"",phone:"",category:""});

  const load=async()=>{ try{const r=await backendApi.getPosOperations();setOperations(r.operations||{});}catch(e:any){toast.error(e?.message||"No se pudieron cargar proveedores");}};
  useEffect(()=>{void load();},[]);

  const add=async()=>{ if(!form.name.trim()) return toast.error("Escribe el nombre del proveedor"); try{const r=await backendApi.savePosSupplier(form);setOperations(r.operations||operations);setForm({name:"",email:"",phone:"",category:""});toast.success("Proveedor guardado");}catch(e:any){toast.error(e?.message||"No se pudo guardar");}};

  const spent=useMemo(()=>(operations.purchases||[]).reduce((s:number,p:any)=>s+Number(p.total||0),0),[operations]);
  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-card p-6"><p className="text-sm font-bold uppercase tracking-wider text-primary">Compras y proveedores</p><h1 className="mt-2 text-3xl font-black">Proveedores Herencia</h1><p className="mt-2 text-muted-foreground">Datos reales compartidos con el TPV y las compras.</p></section>
    <div className="grid gap-4 md:grid-cols-3"><Card icon={Building2} label="Proveedores" value={String((operations.suppliers||[]).length)}/><Card icon={Truck} label="Compras registradas" value={String((operations.purchases||[]).length)}/><Card icon={PackagePlus} label="Compras acumuladas" value={new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(spent)}/></div>
    <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Nuevo proveedor</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{(["name","email","phone","category"] as const).map((key)=><input key={key} value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})} placeholder={{name:"Nombre",email:"Email",phone:"Teléfono",category:"Categoría"}[key]} className="rounded-xl border border-border bg-background p-3"/>)}</div><button onClick={()=>void add()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><Save className="h-4 w-4"/>Guardar proveedor</button></section>
    <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold mb-4">Proveedores registrados</h2><div className="space-y-2">{(operations.suppliers||[]).length===0?<p className="text-sm text-muted-foreground">Aún no hay proveedores.</p>:(operations.suppliers||[]).map((s:any)=><div key={s.id||s.name} className="flex flex-col gap-1 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.category||"Sin categoría"} · {s.email||"Sin email"} · {s.phone||"Sin teléfono"}</p></div></div>)}</div></section>
  </div>;
}
function Card({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-2xl border border-border bg-card p-5"><Icon className="h-6 w-6 text-primary"/><p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>}
