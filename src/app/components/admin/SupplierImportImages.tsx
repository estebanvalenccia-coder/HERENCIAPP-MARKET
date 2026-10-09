import { useState, type ClipboardEvent, type DragEvent } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

/**
 * Uploads product photos visible in the merchant's own browser to Herencia's
 * media library. Does not attempt to bypass suppliers' CAPTCHA challenges.
 */
export function SupplierImportImages({
  images, onChange, onBusyChange, disabled = false,
}: {
  images: string[];
  onChange: (urls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    if (busy || disabled || !files.length) return;
    const remaining = Math.max(0, 8 - images.length);
    if (!remaining) return toast.warning("La galería admite un máximo de ocho fotografías.");
    const selected = files.filter(file => file.type.startsWith("image/")).slice(0, remaining);
    if (!selected.length) return toast.error("Selecciona fotografías JPG, PNG, WEBP, GIF o AVIF.");
    if (selected.some(file => file.size > 8 * 1024 * 1024)) {
      return toast.error("Cada fotografía puede ocupar como máximo 8 MB.");
    }
    setBusy(true);
    onBusyChange?.(true);
    const uploaded: string[] = [];
    try {
      for (const file of selected) {
        const saved = await backendApi.uploadSiteMediaFile(file);
        if (!saved.media?.url) throw new Error("La biblioteca no confirmó la foto subida.");
        uploaded.push(String(saved.media.url));
      }
      onChange([...new Set([...images, ...uploaded])].slice(0, 8));
      window.dispatchEvent(new Event("media-library-changed"));
      toast.success(uploaded.length === 1 ? "Fotografía copiada a la biblioteca de Herencia." : `${uploaded.length} fotografías copiadas a la biblioteca.`);
    } catch (error: any) {
      if (uploaded.length) onChange([...new Set([...images, ...uploaded])].slice(0, 8));
      toast.error(error?.message || "No se pudieron subir las fotografías");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    void upload(files);
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void upload(Array.from(event.dataTransfer.files || []));
  };

  return (
    <div className="space-y-3 rounded-xl border border-amber-300 bg-white p-3 text-sm text-foreground"
      tabIndex={0} onPaste={paste} onDrop={drop} onDragOver={(event) => event.preventDefault()}>
      <p className="font-bold">Fotografías del proveedor — importación asistida</p>
      <p className="text-xs text-muted-foreground">
        Si AliExpress muestra un CAPTCHA al servidor, abre la ficha en tu navegador,
        copia la fotografía y pégala aquí (Cmd/Ctrl + V), o arrástrala/sube el archivo.
        Herencia la guardará en la biblioteca y la adjuntará al borrador.
      </p>
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-semibold ${busy || disabled ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <UploadCloud className="h-4 w-4"/>}
        {busy ? "Copiando imágenes…" : "Subir fotografías"}
        <input type="file" className="sr-only" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          disabled={busy || disabled || images.length >= 8}
          onChange={(event) => { void upload(Array.from(event.target.files || [])); event.target.value = ""; }}/>
      </label>
      <div className="flex flex-wrap gap-2">
        {images.map((url, index) => (
          <div key={url} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-muted">
            <img src={url} alt={`Imagen añadida ${index + 1}`} className="h-full w-full object-contain"/>
            <button type="button" disabled={busy || disabled} aria-label={`Quitar imagen ${index + 1}`}
              title="Quitar de esta importación (sin borrar de la biblioteca)"
              onClick={() => onChange(images.filter(item => item !== url))}
              className="absolute right-1 top-1 rounded-md bg-background/90 p-1 text-destructive">
              <Trash2 className="h-4 w-4"/>
            </button>
          </div>
        ))}
        {!images.length && <div className="flex h-20 items-center gap-2 text-muted-foreground"><ImagePlus className="h-5 w-5"/>Todavía no has añadido fotografías</div>}
      </div>
      <p className="text-xs text-muted-foreground">{images.length}/8 fotografías listas. Debes tener permiso para utilizar las imágenes del proveedor.</p>
    </div>
  );
}
