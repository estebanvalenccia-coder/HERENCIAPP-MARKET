import { useRef, useState } from "react";
import { DatabaseBackup, Download, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";

export function AdminBackupCenter(){
  const [busy,setBusy]=useState(false);
  const fileRef=useRef<HTMLInputElement|null>(null);

  const download=async()=>{
    try{
      setBusy(true);
      const backup=await backendApi.createAdminBackup();
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download=`herencia-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`;
      document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
      toast.success("Copia de seguridad creada");
    }catch(e:any){toast.error(e?.message||"No se pudo crear la copia");}
    finally{setBusy(false);}
  };

  const restore=async(file:File)=>{
    if(!confirm("Esto restaurará configuración, catálogo y operaciones. Los pedidos históricos no se sobrescriben. ¿Continuar?"))return;
    try{
      setBusy(true);
      const backup=JSON.parse(await file.text());
      const result=await backendApi.restoreAdminBackup(backup);
      await backendStorage.refresh();
      toast.success(`Restaurados ${result.restored.length} bloques`);
    }catch(e:any){toast.error(e?.message||"No se pudo restaurar la copia");}
    finally{setBusy(false);if(fileRef.current)fileRef.current.value="";}
  };

  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6"><div className="flex items-center gap-3"><DatabaseBackup className="h-7 w-7 text-primary"/><div><h1 className="text-3xl font-black">Copias de seguridad</h1><p className="mt-1 text-muted-foreground">Protege catálogo, configuración, TPV, proveedores, diseño y reglas de Herencia.</p></div></div></section>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-6"><Download className="h-8 w-8 text-primary"/><h2 className="mt-4 text-xl font-bold">Crear copia</h2><p className="mt-2 text-sm text-muted-foreground">Incluye configuración, catálogo, operaciones y una copia de consulta de hasta 5.000 pedidos.</p><button disabled={busy} onClick={()=>void download()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"><Download className="h-4 w-4"/>Descargar JSON</button></section>
      <section className="rounded-2xl border border-border bg-card p-6"><RotateCcw className="h-8 w-8 text-primary"/><h2 className="mt-4 text-xl font-bold">Restaurar</h2><p className="mt-2 text-sm text-muted-foreground">Antes de restaurar, el backend crea automáticamente un snapshot de seguridad. Los pedidos históricos no se reemplazan.</p><input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e)=>{const f=e.target.files?.[0];if(f)void restore(f);}}/><button disabled={busy} onClick={()=>fileRef.current?.click()} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold disabled:opacity-50"><Upload className="h-4 w-4"/>Elegir copia</button></section>
    </div>
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary"/><div><p className="font-semibold">Restauración protegida</p><p className="text-muted-foreground">La restauración está limitada a datos operativos/configuración permitidos y no borra ni duplica las ventas históricas.</p></div></div></div>
  </div>;
}
