import { useState } from "react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type Preview = Awaited<ReturnType<typeof backendApi.previewSupplierFileCatalog>>;
type Committed = Awaited<ReturnType<typeof backendApi.commitSupplierFileCatalog>>;
type Format = "csv" | "json";

const MAX_FILE_BYTES = 512 * 1024;

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
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | "">("");
  const [error, setError] = useState("");

  const activeSuppliers = (Array.isArray(suppliers) ? suppliers : []).filter(s => s?.active !== false);
  const clearResult = () => {setPreview(null);setCommitted(null);setError("");};
  const loadFile = async (file?: File) => {
    clearResult();
    setContent("");
    setFileName("");
    if(!file) return;
    if(file.size > MAX_FILE_BYTES) {
      setError("Máximo 512 KB por archivo; divide el catálogo en varios archivos.");
      return;
    }
    const suffix = String(file.name.split(".").pop() || "").toLowerCase();
    if(suffix !== "csv" && suffix !== "json") {
      setError("Solo CSV y JSON. Para feeds XML utiliza una exportación autorizada CSV/JSON.");
      return;
    }
    try {
      setContent(await file.text());
      setFileName(file.name);
      setFormat(suffix);
    } catch {
      setError("No se pudo leer el archivo en el navegador.");
    }
  };
  const params = {supplierId,format,content};
  const previewFile = async () => {
    if(busy) return;
    clearResult();
    if(!supplierId) return setError("Registra y selecciona un proveedor primero.");
    if(!content.trim()) return setError("Selecciona un archivo CSV o JSON.");
    setBusy("preview");
    try {
      const result = await backendApi.previewSupplierFileCatalog(params);
      setPreview(result);
    } catch(err:any) {
      setError(String(err?.message || "El archivo no superó la validación."));
    } finally {setBusy("");}
  };
  const commitFile = async () => {
    if(busy || !preview) return;
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
    <h2 className="mt-1 text-xl font-black">Importar productos y variantes desde CSV / JSON</h2>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
      Selecciona un proveedor, carga su catálogo autorizado y revisa una vista previa.
      Una fila equivale a una variante; las filas que comparten <code>product_id</code>
      se agrupan sin inventar colores, tamaños ni combinaciones.
      <strong> Nunca se publican ni se compran automáticamente.</strong>
    </p>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm font-semibold">
        Proveedor registrado
        <select value={supplierId} onChange={e=>{setSupplierId(e.target.value);clearResult();}}
          className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-3">
          <option value="">Selecciona un proveedor</option>
          {activeSuppliers.map(p=><option key={String(p.id)} value={String(p.id)}>{p.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Archivo del proveedor
        <input type="file" accept=".csv,.json,text/csv,application/json"
          onChange={e=>void loadFile(e.target.files?.[0])}
          className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"/>
      </label>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={!supplierId || !content || !!busy} onClick={()=>void previewFile()}
        className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy==="preview"?"Analizando…":"Analizar archivo sin guardar"}
      </button>
      <button type="button" onClick={template}
        className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">
        Descargar plantilla CSV
      </button>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">
      Máximo 512 KB, 300 filas y 60 productos por importación. CSV con separador coma, punto y coma o tabulación.
      JSON como array o como objeto con <code>products</code>; admite variantes anidadas.
      XML necesita un parser seguro y queda para una fase posterior.
    </p>
    {!!fileName && <p className="mt-2 text-xs text-muted-foreground">Archivo: {fileName} · formato {format.toUpperCase()}</p>}

    {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">{error}</p>}

    {preview && <div className="mt-4 rounded-xl border border-primary/30 bg-muted/20 p-4" role="status">
      <h3 className="font-bold">Vista previa: {preview.products.length} productos, {preview.rows} filas</h3>
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
