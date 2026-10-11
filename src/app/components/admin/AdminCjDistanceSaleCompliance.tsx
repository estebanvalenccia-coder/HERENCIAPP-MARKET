import {useEffect,useMemo,useState} from "react";
import {CheckCircle2,FileCheck2,ShieldAlert} from "lucide-react";
import {toast} from "sonner";
import {backendApi} from "../../lib/backendStorage";
import {assessCjDistanceSaleCompliance} from "../../lib/cjDistanceSaleCompliance.js";
import {isCjSupplierItem} from "../../lib/cjFulfillmentIdentity.js";

type Props={product:any;onSaved:()=>void};
type FieldKey="gpsrManufacturerName"|"gpsrManufacturerPostalAddress"|"gpsrManufacturerEmail"|
  "gpsrManufacturerCountryCode"|"gpsrEuResponsibleName"|"gpsrEuResponsiblePostalAddress"|
  "gpsrEuResponsibleEmail"|"gpsrProductModel"|"gpsrSafetyWarningsEs"|
  "gpsrSafetyEvidenceUrl"|"cjImportArrangement"|"cjAdditionalImportCostEur";
const fields:ReadonlyArray<{key:FieldKey;label:string;placeholder:string}>= [
 {key:"gpsrManufacturerName",label:"Fabricante: nombre o razón social",placeholder:"Nombre verificable del fabricante"},
 {key:"gpsrManufacturerPostalAddress",label:"Dirección postal del fabricante",placeholder:"Calle, número, ciudad y país"},
 {key:"gpsrManufacturerEmail",label:"Correo electrónico del fabricante",placeholder:"Contacto verificable del fabricante"},
 {key:"gpsrManufacturerCountryCode",label:"País del fabricante (ISO, 2 letras)",placeholder:"CN / ES / DE…"},
 {key:"gpsrEuResponsibleName",label:"Persona responsable en la UE: nombre o razón social",placeholder:"Si el fabricante está fuera de la UE"},
 {key:"gpsrEuResponsiblePostalAddress",label:"Persona responsable en la UE: dirección postal",placeholder:"Dirección completa dentro de la UE"},
 {key:"gpsrEuResponsibleEmail",label:"Persona responsable en la UE: correo",placeholder:"Contacto verificable"},
 {key:"gpsrProductModel",label:"Modelo o identificación del producto",placeholder:"Modelo, lote o referencia del fabricante"},
 {key:"gpsrSafetyWarningsEs",label:"Advertencias e instrucciones de seguridad en español",placeholder:"Solo advertencias confirmadas por el fabricante"},
 {key:"gpsrSafetyEvidenceUrl",label:"Enlace a la documentación del fabricante (opcional)",placeholder:"https://…"},
 {key:"cjAdditionalImportCostEur",label:"Importes adicionales de importación (€) por unidad",placeholder:"Derechos, gestiones y costes realmente aplicables"},
];
const stringVal=(value:unknown)=>String(value??"");
const initial=(product:any)=>{
 const m=product?.metadata&&typeof product.metadata==="object"?product.metadata:{};
 return Object.fromEntries(fields.map(field=>[field.key,stringVal(m[field.key])])) as Record<FieldKey,string>;
};

/** Admin-only editor for documentary facts. Never certifies manufacturer details or authorizes spending. */
export function AdminCjDistanceSaleCompliance({product,onSaved}:Props){
 const [values,setValues]=useState(()=>initial(product));
 const [reviewed,setReviewed]=useState(Boolean(product?.metadata?.gpsrSafetyReviewed));
 const [noWarnings,setNoWarnings]=useState(Boolean(product?.metadata?.gpsrNoWarningsApplicable));
 const [importReviewed,setImportReviewed]=useState(Boolean(product?.metadata?.cjImportCostsReviewed));
 const [arrangement,setArrangement]=useState(String(product?.metadata?.cjImportArrangement||""));
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
   setValues(initial(product));
   setReviewed(Boolean(product?.metadata?.gpsrSafetyReviewed));
   setNoWarnings(Boolean(product?.metadata?.gpsrNoWarningsApplicable));
   setImportReviewed(Boolean(product?.metadata?.cjImportCostsReviewed));
   setArrangement(String(product?.metadata?.cjImportArrangement||""));
 },[product?.id,product?.metadata]);
 const metadata=product?.metadata&&typeof product.metadata==="object"?product.metadata:{};
 const draft=useMemo(()=>({
   ...metadata,...values,
   gpsrManufacturerCountryCode:values.gpsrManufacturerCountryCode.trim().toUpperCase(),
   gpsrSafetyReviewed:reviewed,gpsrNoWarningsApplicable:noWarnings,
   cjImportArrangement:arrangement,cjImportCostsReviewed:importReviewed,
 }),[metadata,values,reviewed,noWarnings,arrangement,importReviewed]);
 const status=assessCjDistanceSaleCompliance({...product,metadata:draft});
 if(!isCjSupplierItem(product))return null;
 const save=async()=>{
  if(busy)return;
  const c=String(draft.cjAdditionalImportCostEur).trim();
  if(c!==""&&(!/^(0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(c)||Number(c)>1000)){
    toast.error("Introduce el coste adicional real en EUR (0–1000, máximo dos decimales).");
    return;
  }
  const country=String(draft.gpsrManufacturerCountryCode).trim();
  if(country&&!/^[A-Z]{2}$/.test(country)){
    toast.error("El país del fabricante debe tener dos letras ISO.");
    return;
  }
  if(noWarnings&&String(draft.gpsrSafetyWarningsEs||"").trim()){
    toast.error("No puedes indicar que no existen advertencias y escribir advertencias a la vez.");
    return;
  }
  setBusy(true);
  try{
    await backendApi.updateCommerceProduct(String(product.id),{metadata:draft});
    toast.success(status.ready?
      "Documentación declarada guardada. Comprueba su autenticidad antes de vender.":
      "Borrador de cumplimiento guardado. Siguen faltando datos.");
    onSaved();
  }catch(error:any){
    toast.error(String(error?.message||"No se pudo guardar la documentación del producto."));
  }finally{setBusy(false);}
 };
 return <details className="mt-3 rounded-xl border border-amber-300 bg-amber-50/50 p-3">
   <summary className="cursor-pointer text-xs font-bold text-amber-950">
     {status.ready?"Revisar documentación de venta UE":"Completar seguridad, fabricante e importación UE"}
     {" · "}{status.blockers.length} comprobaciones pendientes
   </summary>
   <div className="mt-3 space-y-3">
     <p className="text-xs text-amber-950">
       Introduce únicamente datos comprobados con documentos oficiales del proveedor. Declarar estos datos
       no sustituye la evaluación de seguridad, la conformidad CE cuando aplique ni la asesoría fiscal.
       No se realizarán compras al completar el formulario.
     </p>
     {status.blockers.length>0&&<ul className="list-disc space-y-1 pl-5 text-xs text-amber-950">
       {status.blockers.map((item:string,i:number)=><li key={i}>{item}</li>)}
     </ul>}
     <div className="grid gap-3 md:grid-cols-2">
       {fields.map(field=><label key={field.key} className={field.key==="gpsrSafetyWarningsEs"?"md:col-span-2":"min-w-0"}>
         <span className="block text-xs font-semibold">{field.label}</span>
         {field.key==="gpsrSafetyWarningsEs"?
           <textarea rows={3} value={values[field.key]} placeholder={field.placeholder}
             onChange={e=>setValues(current=>({...current,[field.key]:e.target.value}))}
             className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>:
           <input type={field.key.endsWith("Email")?"email":field.key==="cjAdditionalImportCostEur"?"number":"text"}
             min={field.key==="cjAdditionalImportCostEur"?"0":undefined}
             max={field.key==="cjAdditionalImportCostEur"?"1000":undefined}
             step={field.key==="cjAdditionalImportCostEur"?"0.01":undefined}
             value={values[field.key]} placeholder={field.placeholder}
             onChange={e=>setValues(current=>({...current,[field.key]:e.target.value}))}
             className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>}
       </label>)}
       <label className="md:col-span-2">
         <span className="block text-xs font-semibold">Régimen de importación acreditado</span>
         <select value={arrangement} onChange={e=>setArrangement(e.target.value)}
           className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
           <option value="">Sin confirmar</option>
           <option value="DDP">DDP — derechos y tributos gestionados antes de entregar</option>
           <option value="IOSS">IOSS — IVA de importación gestionado conforme al régimen aplicable</option>
         </select>
         <span className="mt-1 block text-xs text-muted-foreground">IOSS no garantiza por sí solo el pago de aranceles: verifica quién es importador, quién liquida el derecho de 3 € cuando corresponda y qué paga el cliente.</span>
       </label>
     </div>
     <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={reviewed}
       onChange={e=>setReviewed(e.target.checked)}/>
       <span>He contrastado documentación del producto, riesgos e instrucciones con el fabricante.</span></label>
     <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={noWarnings}
       onChange={e=>setNoWarnings(e.target.checked)}/>
       <span>El fabricante acredita que no hay advertencias específicas aplicables a este producto.</span></label>
     <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={importReviewed}
       onChange={e=>setImportReviewed(e.target.checked)}/>
       <span>He verificado tributación, derechos, gastos de gestión y quién los abona para esta ruta de importación.</span></label>
     <div className="flex flex-wrap items-center justify-between gap-3">
       <div className="flex items-center gap-2 text-xs font-semibold">
         {status.ready?<CheckCircle2 className="h-4 w-4 text-emerald-700"/>:
           <ShieldAlert className="h-4 w-4 text-amber-700"/>}
         {status.ready?"Declaraciones completas (sin certificación independiente)":
           "Información incompleta: artículo no apto para cobrar"}
       </div>
       <button type="button" onClick={()=>void save()} disabled={busy}
         className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">
         <FileCheck2 className="h-4 w-4"/>{busy?"Guardando…":"Guardar documentación"}
       </button>
     </div>
   </div>
 </details>;
}
