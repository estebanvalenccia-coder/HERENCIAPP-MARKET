import { useState } from "react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type Preview = Awaited<ReturnType<typeof backendApi.previewSupplierFileCatalog>>;
type Committed = Awaited<ReturnType<typeof backendApi.commitSupplierFileCatalog>>;
type Format = "csv" | "json" | "xml";

const MAX_FILE_BYTES = 512 * 1024;
const MAPPING_FIELDS = [
  ["product_id","Identificador de producto"],["product_name","Nombre del producto"],
  ["variant_id","Identificador de variante"],["supplier_sku","SKU del proveedor"],
  ["cost","Coste de compra"],["currency","Moneda"],["product_url","URL original"],
  ["image_url","URL de imagen"],["category","Categoría"],
  ["description","Descripción"],["variant_name","Nombre de combinación"],
  ["brand","Fabricante / marca"],["mpn","Referencia MPN"],["gtin","GTIN/EAN"],
  ["supplier_stock","Stock declarado (sin verificar)"],
] as const;
const VARIANT_OPTION_LIMIT=4;

/**
 * No API keys or provider sessions. This component never auto-publishes and
 * cannot trigger checkout/order endpoints. Any saved products are safe drafts.
 */
export function AdminSupplierFileImport({
  suppliers = [], onOpenProduct, onCompleted,
}: {
  suppliers?: any[];
  onOpenProduct: (id: string) => void;
  onCompleted?: () => void | Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState<Format>("csv");
  const [columns, setColumns] = useState<Array<{key:string; example:string}>>([]);
  const [columnMap, setColumnMap] = useState<Record<string,string>>({});
  const [optionFields, setOptionFields] = useState<Array<{label:string;source:string}>>([]);
  const [inspectionBusy, setInspectionBusy] = useState(false);
  const [profileBusy,setProfileBusy] = useState(false);
  const [profileSavedAt,setProfileSavedAt] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | "">("");
  const [error, setError] = useState("");
  const [reviewBusy,setReviewBusy]=useState("");
  const [reviewConfirmed,setReviewConfirmed]=useState<Record<string,boolean>>({});

  const activeSuppliers = (Array.isArray(suppliers) ? suppliers : []).filter(s => s?.active !== false);
  const clearResult = () => {setPreview(null);setCommitted(null);setError("");setReviewConfirmed({});};
  const loadFile = async (file?: File) => {
    clearResult();
    setColumns([]);
    setProfileSavedAt("");
    setColumnMap({});
    setOptionFields([]);
    setContent("");
    setFileName("");
    if(!file) return;
    if(file.size > MAX_FILE_BYTES) {
      setError("Máximo 512 KB por archivo; divide el catálogo en varios archivos.");
      return;
    }
    const suffix = String(file.name.split(".").pop() || "").toLowerCase();
    if(suffix !== "csv" && suffix !== "json" && suffix !== "xml") {
      setError("Solo CSV, JSON y XML. Para otros formatos solicita un catálogo compatible al proveedor.");
      return;
    }
    try {
      setContent(await file.text());
      setFileName(file.name);
      setFormat(suffix as Format);
    } catch {
      setError("No se pudo leer el archivo en el navegador.");
    }
  };
  const targetColumns:Record<string,string>={...columnMap};
  for(const entry of optionFields) {
    const normalized=entry.label.trim().toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
    if(entry.source && normalized)targetColumns["option_"+normalized]=entry.source;
  }
  const params = {supplierId,format,content,columnMap:targetColumns};
  const inspectFile = async () => {
    if(!content.trim() || busy || inspectionBusy)return;
    setInspectionBusy(true);
    clearResult();
    try {
      const result=await backendApi.inspectSupplierFileCatalog({format,content});
      setColumns(result.columns);
      setProfileSavedAt("");
      if(supplierId) {
        const saved=await backendApi.getSupplierFileColumnMap(supplierId,format)
          .catch(()=>null);
        if(saved?.exists) {
          const present=new Set(result.columns.map(c=>c.key));
          const accepted=Object.entries(saved.columnMap).filter(([,source])=>present.has(source));
          setColumnMap(Object.fromEntries(accepted.filter(([target])=>!target.startsWith("option_"))));
          setOptionFields(accepted.filter(([target])=>target.startsWith("option_"))
            .map(([target,source])=>({label:target.slice(7),source})));
          setProfileSavedAt(String(saved.updatedAt||""));
        } else {setColumnMap({});setOptionFields([]);}
      }
    } catch(err:any) {
      setColumns([]);
      setError(String(err?.message||"No se pudo analizar la estructura del catálogo."));
    } finally {setInspectionBusy(false);}
  };
  const updateMapping = (target:string,source:string) => {
    setColumnMap(current=>{
      const next={...current};
      if(source)next[target]=source;else delete next[target];
      return next;
    });
    setProfileSavedAt("");
    clearResult();
  };
  const saveProfile=async()=>{
    if(profileBusy||!supplierId||columns.length===0)return;
    setProfileBusy(true);
    setError("");
    try {
      const saved=await backendApi.saveSupplierFileColumnMap({
        supplierId,format,columns:columns.map(c=>c.key),columnMap:targetColumns,
      });
      setProfileSavedAt(String(saved.updatedAt||""));
      toast.success("Mapeo del proveedor guardado para próximas importaciones.");
    } catch(err:any) {
      setError(String(err?.message||"No se pudo guardar el perfil."));
    } finally {setProfileBusy(false);}
  };
  const previewFile = async () => {
    if(busy || inspectionBusy || reviewBusy) return;
    clearResult();
    if(!supplierId) return setError("Registra y selecciona un proveedor primero.");
    if(!content.trim()) return setError("Selecciona un archivo CSV, JSON o XML.");
    setBusy("preview");
    try {
      const result = await backendApi.previewSupplierFileCatalog(params);
      setPreview(result);
    } catch(err:any) {
      setError(String(err?.message || "El archivo no superó la validación."));
    } finally {setBusy("");}
  };
  const approveSupplierCosts=async(productId:string,expectedUpdatedAt:string)=>{
    if(reviewBusy||!reviewConfirmed[productId])return;
    setReviewBusy(productId);setError("");
    try{
      const result=await backendApi.reviewSupplierFileCosts({
        ...params,productId,expectedUpdatedAt,
      });
      toast.success("Costes del proveedor revisados; precio de venta y stock intactos.");
      const fresh=await backendApi.previewSupplierFileCatalog(params);
      setPreview(fresh);
      setReviewConfirmed({});
      if(onCompleted)await onCompleted();
    }catch(err:any){
      setError(String(err?.message||"El borrador cambió; actualiza la vista previa antes de aprobar."));
    }finally{setReviewBusy("");}
  };

  const commitFile = async () => {
    if(busy || !preview || inspectionBusy || reviewBusy) return;
    setBusy("commit");
    setError("");
    try {
      const result = await backendApi.commitSupplierFileCatalog(params);
      setCommitted(result);
      setPreview(null);
      toast.success(result.created + " borradores nuevos; " + result.skipped + " existentes sin cambios.");
      if (result.created && onCompleted) await onCompleted();
    } catch(err:any) {
      setError(String(err?.message || "No se pudieron guardar los borradores."));
    } finally {setBusy("");}
  };
  const template = () => {
    const header="product_id;product_name;variant_id;supplier_sku;option_color;option_talla;cost;currency;product_url";
    const row1="REF001;Camiseta;REF001-RED-S;TSHIRT-RED-S;Rojo;S;4,75;EUR;https://proveedor.example.com/camiseta";
    const row2="REF001;Camiseta;REF001-BLUE-M;TSHIRT-BLUE-M;Azul;M;4,95;EUR;https://proveedor.example.com/camiseta";
    const blob = new Blob(["\uFEFF"+[header,row1,row2].join("\r\n")],
      {type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="herencia_plantilla_catalogo_proveedor.csv";a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  return <section id="supplier-file-import" className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
    <p className="text-sm font-extrabold uppercase tracking-wide text-primary">
      Catálogos propios · Sin APIs · Sin DSers
    </p>
    <h2 className="mt-1 text-xl font-black">Importar productos y variantes desde CSV / JSON / XML</h2>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
      Selecciona un proveedor, carga su catálogo autorizado y revisa una vista previa.
      Una fila equivale a una variante; las filas que comparten <code>product_id</code>
      se agrupan sin inventar colores, tamaños ni combinaciones.
      <strong> Nunca se publican ni se compran automáticamente.</strong>
    </p>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm font-semibold">
        Proveedor registrado
        <select value={supplierId} onChange={e=>{setSupplierId(e.target.value);setColumns([]);setColumnMap({});setOptionFields([]);setProfileSavedAt("");clearResult();}}
          className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-3">
          <option value="">Selecciona un proveedor</option>
          {activeSuppliers.map(p=><option key={String(p.id)} value={String(p.id)}>{p.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Archivo del proveedor
        <input type="file" accept=".csv,.json,.xml,text/csv,application/json,text/xml,application/xml"
          onChange={e=>void loadFile(e.target.files?.[0])}
          className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"/>
      </label>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={!content || !!busy || inspectionBusy} onClick={()=>void inspectFile()}
        className="rounded-xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-50">
        {inspectionBusy?"Leyendo columnas…":"Inspeccionar columnas"}
      </button>
      <button type="button" disabled={!supplierId || !content || !!busy || inspectionBusy} onClick={()=>void previewFile()}
        className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy==="preview"?"Analizando…":"Previsualizar productos y cambios"}
      </button>
      <button type="button" onClick={template}
        className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">
        Descargar plantilla CSV
      </button>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">
      Máximo 512 KB, 300 filas y 30 productos por importación. CSV con separador coma, punto y coma o tabulación.
      JSON como array o como objeto con <code>products</code>; admite variantes anidadas.
      XML acepta raíces <code>products</code>, <code>catalog</code>, <code>feed</code> o <code>items</code>, sin DTD ni entidades externas.
    </p>
    {!!fileName && <p className="mt-2 text-xs text-muted-foreground">Archivo: {fileName} · formato {format.toUpperCase()}</p>}

    {columns.length>0 && <div className="mt-4 rounded-xl border border-primary/25 bg-muted/20 p-4">
      <h3 className="font-bold">Relacionar columnas del proveedor</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Encontradas {columns.length} columnas. Deja «Detección automática» cuando la columna
        ya tenga un nombre habitual. Elige una columna cuando el proveedor use otro nombre;
        los cambios no se guardan ni se sincronizan automáticamente.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {MAPPING_FIELDS.map(([target,label])=><label key={target} className="text-xs font-semibold">
          {label}
          <select value={columnMap[target]||""} onChange={e=>updateMapping(target,e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5">
            <option value="">Detección automática</option>
            {columns.map(column=><option key={column.key} value={column.key}>
              {column.key}{column.example?" · "+column.example.slice(0,30):""}
            </option>)}
          </select>
        </label>)}
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-sm font-semibold">Atributos dinámicos de variantes (hasta cuatro)</p>
        <p className="mt-1 text-xs text-muted-foreground">Ejemplo: atributo «Enchufe» → columna «plug_type». No se inventarán combinaciones.</p>
        <div className="mt-3 grid gap-2">
          {optionFields.map((option,index)=><div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input aria-label={"Nombre del atributo "+(index+1)} value={option.label}
              placeholder="Color, talla, enchufe, material…"
              onChange={e=>{setOptionFields(current=>current.map((x,i)=>i===index?{...x,label:e.target.value.slice(0,48)}:x));setProfileSavedAt("");clearResult();}}
              className="rounded-lg border border-border bg-background p-2.5 text-sm"/>
            <select aria-label={"Columna del atributo "+(index+1)} value={option.source}
              onChange={e=>{setOptionFields(current=>current.map((x,i)=>i===index?{...x,source:e.target.value}:x));setProfileSavedAt("");clearResult();}}
              className="rounded-lg border border-border bg-background p-2.5 text-sm">
              <option value="">Selecciona columna</option>
              {columns.map(c=><option key={c.key} value={c.key}>{c.key}</option>)}
            </select>
            <button type="button" onClick={()=>{setOptionFields(current=>current.filter((_,i)=>i!==index));setProfileSavedAt("");clearResult();}}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Quitar</button>
          </div>)}
        </div>
        <button type="button" disabled={optionFields.length>=VARIANT_OPTION_LIMIT}
          onClick={()=>{setOptionFields(current=>[...current,{label:"",source:""}]);setProfileSavedAt("");clearResult();}}
          className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">
          + Añadir atributo
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!supplierId||profileBusy||!!busy||inspectionBusy}
          onClick={()=>void saveProfile()}
          className="rounded-lg border border-primary px-4 py-2.5 text-xs font-bold disabled:opacity-50">
          {profileBusy?"Guardando perfil…":"Guardar mapeo para este proveedor"}
        </button>
        {profileSavedAt && <p className="text-xs font-semibold text-emerald-800">
          Perfil guardado y recuperable al inspeccionar otro archivo del mismo proveedor y formato.
        </p>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Los perfiles solo incluyen nombres de columnas, nunca precios, contraseñas ni productos. Si cambias el archivo, proveedor o columnas, vuelve a ejecutar la vista previa antes de importar.</p>
    </div>}

    {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">{error}</p>}

    {preview && <div className="mt-4 rounded-xl border border-primary/30 bg-muted/20 p-4" role="status">
      <h3 className="font-bold">Vista previa: {preview.products.length} productos, {preview.rows} filas</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Nuevos: {preview.reconciliation.filter(r=>r.status==="new").length} ·
        Existentes con cambios: {preview.reconciliation.filter(r=>r.status==="changes_detected").length} ·
        Conflictos: {preview.reconciliation.filter(r=>r.status==="conflict").length}.
        Solo se guardan borradores nuevos. Los existentes se comparan sin modificarse.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{preview.message}</p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {preview.products.map(item=><div key={item.id} className="rounded-lg border border-border bg-background p-3">
          <p className="font-semibold">{item.name} <span className="text-xs font-normal text-muted-foreground">({item.supplierProductId})</span></p>
          <p className="mt-1 text-xs">
            {item.variantCount} variantes · {item.minSupplierCost===null
              ? "Coste no informado"
              : "Desde "+item.minSupplierCost.toFixed(2)+" "+(item.currency || "sin divisa")}
          </p>
          {item.variants.length > 0 && <p className="mt-1 text-xs text-muted-foreground">
            Combinaciones reales: {item.variants.slice(0,5).map(v=>v.name).join(" · ")}
            {item.variantCount>5?" …":""}
          </p>}
          {(() => {
            const comparison=preview.reconciliation.find(r=>r.id===item.id);
            if(!comparison)return null;
            const label={
              new:"Producto nuevo",
              unchanged:"Ya existe · Sin diferencias de proveedor",
              changes_detected:"Cambios detectados (requiere revisión manual)",
              conflict:"Conflicto con una ficha existente (no se importará)",
            }[comparison.status];
            return <p className="mt-1 text-xs font-semibold text-primary">
              {label}{comparison.changedFields.length>0?" · Campos: "+comparison.changedFields.join(", "):""}
            </p>;
          })()}
          {(() => {
            const comparison=preview.reconciliation.find(r=>r.id===item.id);
            if(!comparison?.canApproveCosts||!comparison.sourceUpdatedAt)return null;
            return <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3">
              <p className="text-xs font-semibold text-amber-900">
                El archivo contiene costes nuevos para variantes que mantienen los mismos SKU/VID.
                Puedes guardar solo esos costes como datos NO verificados. El precio público,
                la descripción, las fotos y el stock permanecerán exactamente igual.
              </p>
              {!!comparison.alerts?.length&&<ul className="mt-2 list-disc pl-5 text-xs text-amber-900">
                {comparison.alerts.slice(0,5).map((warning,i)=><li key={i}>
                  {warning.type==="cost_increase"?"Subida de coste":
                    warning.type==="supplier_reports_out_of_stock"?"Proveedor declara agotado":
                    warning.type==="currency_changed"?"Cambio de divisa":warning.type}
                  {" · "}{warning.variant}
                </li>)}
              </ul>}
              <label className="mt-2 flex items-start gap-2 text-xs font-semibold">
                <input type="checkbox" checked={Boolean(reviewConfirmed[item.id])}
                  onChange={e=>setReviewConfirmed(old=>({...old,[item.id]:e.target.checked}))}/>
                Confirmo que he revisado la ficha original y deseo guardar SOLO costes del archivo,
                sin publicar ni actualizar stock.
              </label>
              <button type="button"
                disabled={!reviewConfirmed[item.id]||Boolean(reviewBusy)||Boolean(busy)}
                onClick={()=>void approveSupplierCosts(item.id,comparison.sourceUpdatedAt!)}
                className="mt-2 rounded-lg border border-amber-600 bg-white px-3 py-2 text-xs font-bold text-amber-950 disabled:opacity-50">
                {reviewBusy===item.id?"Guardando revisión…":"Aprobar únicamente costes del proveedor"}
              </button>
            </div>;
          })()}
          <p className="mt-1 text-xs text-amber-800">Stock y portes pendientes de verificar · Precio público: sin configurar</p>
        </div>)}
      </div>
      <p className="mt-3 text-sm font-semibold">
        Confirmar guardará solamente borradores sin imágenes publicadas, precio de venta ni stock,
        y omitirá cualquier producto que ya exista para no pisar tus cambios.
      </p>
      <button type="button" disabled={!!busy} onClick={()=>void commitFile()}
        className="mt-3 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
        {busy==="commit"?"Guardando borradores…":"Confirmar y guardar borradores en Neon"}
      </button>
    </div>}

    {committed && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" role="status">
      <h3 className="font-bold">Importación terminada</h3>
      <p className="mt-1 text-sm">{committed.created} creados · {committed.skipped} ya existentes sin modificar · {committed.failed} fallidos.</p>
      <div className="mt-3 max-h-64 space-y-2 overflow-auto">
        {committed.results.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
          <div>
            <p className="text-sm font-semibold">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.status==="created"?"Borrador nuevo":item.status==="skipped_existing"?"Existente, sin cambios":"Error al guardar"}
              {item.message?": "+item.message:""}
            </p>
          </div>
          {item.status==="created" && <button type="button" onClick={()=>onOpenProduct(item.id)}
            className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Editar borrador</button>}
        </div>)}
      </div>
    </div>}
  </section>;
}
