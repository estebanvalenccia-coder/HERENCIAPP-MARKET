import { useMemo, useState } from "react";
import { Download, ImagePlus, Link2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";
import { SupplierImportImages } from "./SupplierImportImages";

type SourceCatalogProduct = {
  id: string;
  name: string;
  description?: string;
  productUrl: string;
  sourceCatalogUrl: string;
  sourceHost: string;
  image?: string;
  images?: string[];
  supplierCategory?: string;
  category?: string;
  collection?: string;
  type?: string;
  department?: string;
  area?: string;
  family?: string;
};


export function AdminSupplierCatalogUrlImport({ onOpenProduct }: { onOpenProduct: (productId: string) => void }) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceManual, setSourceManual] = useState<{ url: string; host: string; reason: string } | null>(null);
  const [sourceManualName, setSourceManualName] = useState("");
  const [sourceManualCost, setSourceManualCost] = useState("");
  const [sourceManualImage, setSourceManualImage] = useState("");
  const [sourceManualUploadedImages, setSourceManualUploadedImages] = useState<string[]>([]);
  const [sourceManualUploading, setSourceManualUploading] = useState(false);
  const [sourceManualSaving, setSourceManualSaving] = useState(false);
  const [savedSourceProduct, setSavedSourceProduct] = useState<{ id: string; name: string; status: string; outcome: string } | null>(null);
  const [sourceProducts, setSourceProducts] = useState<SourceCatalogProduct[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<string, boolean>>({});
  const [selectedSourceImages, setSelectedSourceImages] = useState<Record<string, boolean>>({});
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceImporting, setSourceImporting] = useState(false);
  const [sourceSavingMedia, setSourceSavingMedia] = useState(false);
  const [repairingImported, setRepairingImported] = useState(false);
  const [sourceProgress, setSourceProgress] = useState({ done: 0, total: 0 });

  const selectedSourceProducts = useMemo(
    () => sourceProducts.filter((product) => selectedSourceIds[product.id]),
    [sourceProducts, selectedSourceIds]
  );

  const productImageUrls = (product: SourceCatalogProduct) =>
    Array.from(
      new Set(
        (product.images?.length ? product.images : product.image ? [product.image] : [])
          .map((url) => String(url || "").trim())
          .filter(Boolean)
      )
    );

  const sourceImageKey = (product: SourceCatalogProduct, url: string) =>
    String(product.id) + "::" + url;

  const selectedImagesForProduct = (product: SourceCatalogProduct) =>
    productImageUrls(product).filter((url) => selectedSourceImages[sourceImageKey(product, url)]);

  const selectedSourceImageCount = useMemo(
    () =>
      sourceProducts.reduce(
        (count, product) =>
          count + productImageUrls(product).filter((url) => selectedSourceImages[sourceImageKey(product, url)]).length,
        0
      ),
    [sourceProducts, selectedSourceImages]
  );


  const analyzeSourceCatalog = async () => {
    const url = sourceUrl.trim();
    if (!url) {
      toast.error("Pega primero la URL del catálogo del proveedor");
      return;
    }

    setSourceLoading(true);
    setSourceProducts([]);
    setSourceManual(null);
    setSourceManualUploadedImages([]);
    setSavedSourceProduct(null);
    setSelectedSourceIds({});
    setSelectedSourceImages({});
    setSourceProgress({ done: 0, total: 0 });

    try {
      const result = await backendApi.previewCatalogUrl(url, 100);
      const products = Array.isArray(result.products) ? result.products : [];
      setSourceProducts(products);
      setSelectedSourceIds({});
      setSelectedSourceImages({});
      if (result.requiresManual || !products.length) {
        setSourceManual({
          url: result.sourceUrl || url,
          host: result.sourceHost || new URL(url).hostname,
          reason: result.message || "El proveedor no permitió acceder a las fotografías o los datos del producto.",
        });
        toast.warning("Importación automática incompleta. Puedes crear un borrador privado con los datos reales.");
      } else {
        toast.success(products.length + " productos detectados en " + result.sourceHost);
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo analizar el catálogo del proveedor");
    } finally {
      setSourceLoading(false);
    }
  };

  const saveSourceManualDraft = async () => {
    if (!sourceManual) return;
    const name = sourceManualName.trim();
    if (!name) return toast.error("Escribe el nombre real del producto");
    if (/^(human verification|human machine check|verify you are human|just a moment|access denied|security verification|captcha)(?:\\b|[\\s.:|—-])/i.test(name)) {
      return toast.error("La pantalla de verificación no es un producto");
    }
    if (sourceManualCost.trim() && (!Number.isFinite(Number(sourceManualCost)) || Number(sourceManualCost) < 0)) {
      return toast.error("Revisa el coste del proveedor");
    }
    const rawImage = sourceManualImage.trim();
    if (rawImage) {
      try {
        const url = new URL(rawImage);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
      } catch { return toast.error("Pega una URL pública válida de imagen"); }
    }
    if (sourceManualUploading) return toast.warning("Espera a que terminen de subir las fotografías.");
    setSourceManualSaving(true);
    setSavedSourceProduct(null);
    try {
      const result = await backendApi.importCatalogUrlProduct({
        name,
        productUrl: sourceManual.url,
        sourceCatalogUrl: sourceManual.url,
        sourceHost: sourceManual.host,
        supplierPrice: Number(sourceManualCost || 0),
        supplierCurrency: "EUR",
        description: "",
        image: sourceManualUploadedImages[0] || rawImage,
        images: [...new Set([...sourceManualUploadedImages, ...(rawImage ? [rawImage] : [])])],
        manualImport: true,
      });
      if (!result.ok || !result.product?.id) throw new Error("El servidor no confirmó el producto guardado");
      const lookup = await backendApi.getCommerceProduct(result.product.id);
      if (!lookup.product || String(lookup.product.id) !== String(result.product.id)) {
        throw new Error("No se encuentra el artículo en el catálogo después de guardarlo");
      }
      const found = lookup.product;
      const archived = found.status === "archived" || Boolean(found.deletedAt);
      setSavedSourceProduct({
        id: String(found.id),
        name: String(found.name || name),
        status: String(found.status || "draft"),
        outcome: archived ? "archived" : result.skipped ? "existing" : result.updated ? "updated" : "created",
      });
      toast.info(archived ? "Ya existe en la Papelera; no se creó otro." :
        result.skipped ? "El producto ya existía. Puedes abrirlo desde aquí." : "Borrador guardado en Productos → Ver productos");
      if (result.imageImportWarning) toast.warning(result.imageImportWarning);
      if (!result.skipped && !archived) setSourceManual(null);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo confirmar que el producto se guardó");
    } finally {
      setSourceManualSaving(false);
    }
  };

  const repairImportedDrafts = async () => {
    const host = (() => {
      try {
        return sourceUrl.trim() ? new URL(sourceUrl.trim()).hostname : "";
      } catch {
        return "";
      }
    })();

    const scope = host ? "los borradores importados desde " + host : "todos los borradores importados por URL";
    if (!window.confirm("Se repararán " + scope + ". Se conservarán precio, stock y datos comerciales, pero se actualizarán galería y clasificación desde la ficha original. ¿Continuar?")) {
      return;
    }

    setRepairingImported(true);
    try {
      const result = await backendApi.repairImportedCatalogDrafts(host, 50);
      if (!result.candidates) {
        toast.info("No hay borradores importados pendientes de reparar");
      } else if (result.errors) {
        toast.warning("Reparación terminada: " + result.repaired + " corregidos y " + result.errors + " con error");
      } else {
        toast.success("✅ " + result.repaired + " borradores importados reparados");
      }
      window.dispatchEvent(new Event("commerce-products-changed"));
      window.dispatchEvent(new Event("media-library-changed"));
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron reparar los borradores importados");
    } finally {
      setRepairingImported(false);
    }
  };

  const saveSelectedSourceMedia = async () => {
    const selected = sourceProducts
      .map((product) => ({ product, images: selectedImagesForProduct(product) }))
      .filter((item) => item.images.length > 0);

    if (!selected.length) {
      toast.error("Selecciona primero una o varias fotos");
      return;
    }

    setSourceSavingMedia(true);
    setSourceProgress({ done: 0, total: selected.length });
    let copied = 0;
    let errors = 0;
    const completedKeys: string[] = [];

    for (let index = 0; index < selected.length; index += 1) {
      const { product, images } = selected[index];
      try {
        const result = await backendApi.saveCatalogUrlProductMedia({
          ...product,
          image: images[0] || "",
          images,
        });
        copied += Number(result.copiedImages || 0);
        images.forEach((url) => completedKeys.push(sourceImageKey(product, url)));
      } catch {
        errors += 1;
      } finally {
        setSourceProgress({ done: index + 1, total: selected.length });
      }
    }

    if (completedKeys.length) {
      setSelectedSourceImages((current) => {
        const next = { ...current };
        completedKeys.forEach((key) => delete next[key]);
        return next;
      });
    }

    setSourceSavingMedia(false);
    window.dispatchEvent(new Event("media-library-changed"));

    if (errors) {
      toast.warning("Biblioteca actualizada: " + copied + " fotos guardadas y " + errors + " grupos con error");
    } else {
      toast.success("✅ " + copied + " fotos guardadas en la Biblioteca multimedia");
    }
  };

  const importSelectedSourceProducts = async () => {
    const selected = selectedSourceProducts;
    if (!selected.length) {
      toast.error("Selecciona al menos un producto");
      return;
    }

    setSourceImporting(true);
    setSourceProgress({ done: 0, total: selected.length });
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const completedIds: string[] = [];
    let lastSaved: { id: string; name: string; status: string; outcome: string } | null = null;
    setSavedSourceProduct(null);

    for (let index = 0; index < selected.length; index += 1) {
      const product = selected[index];
      try {
        const chosenImages = selectedImagesForProduct(product);
        const mainImage = product.image || productImageUrls(product)[0] || "";
        const importImages = chosenImages.length ? chosenImages : mainImage ? [mainImage] : [];
        const result = await backendApi.importCatalogUrlProduct({
          ...product,
          image: importImages[0] || "",
          images: importImages,
        });
        if (!result.product?.id) throw new Error("El proveedor no devolvió un ID de producto");
        if (result.skipped) skipped += 1;
        else if (result.updated) updated += 1;
        else imported += 1;
        lastSaved = {
          id: String(result.product.id),
          name: String(result.product.name || product.name),
          status: String(result.product.status || "draft"),
          outcome: result.reason === "archived_duplicate" ? "archived" :
            result.skipped ? "existing" : result.updated ? "updated" : "created",
        };
        completedIds.push(product.id);
      } catch {
        errors += 1;
      } finally {
        setSourceProgress({ done: index + 1, total: selected.length });
      }
    }

    if (completedIds.length) {
      setSelectedSourceIds((current) => {
        const next = { ...current };
        completedIds.forEach((id) => {
          next[id] = false;
        });
        return next;
      });
    }

    setSourceImporting(false);
    if (lastSaved) {
      try {
        const lookup = await backendApi.getCommerceProduct(lastSaved.id);
        if (lookup.product && String(lookup.product.id) === lastSaved.id) {
          setSavedSourceProduct(lastSaved);
        } else toast.warning("No se pudo localizar el último producto en el catálogo");
      } catch { toast.warning("Se importaron productos, pero no pudimos comprobar el último registro"); }
    }
    if (errors) {
      toast.warning("Importación terminada: " + imported + " nuevos, " + updated + " reparados, " + skipped + " ya existentes y " + errors + " con error");
    } else {
      toast.success("Importación terminada: " + imported + " nuevos, " + updated + " reparados y " + skipped + " ya existentes");
    }
  };
  return (
    <section id="supplier-url-catalog" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl font-bold text-foreground">Importar catálogos de proveedores por URL</h2>
      <p className="mt-2 text-sm text-muted-foreground">Esta herramienta de proveedores está separada de la subida masiva de fotografías.</p>
        <div className="mb-6 rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground">Importar desde URL del proveedor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pega una página de catálogo. Tropical Plants detecta los productos, te deja elegir cuáles traer y copia sus imágenes a Cloudflare R2.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={sourceUrl}
              onChange={(event) => { setSourceUrl(event.target.value); setSourceManual(null); setSourceManualUploadedImages([]); setSavedSourceProduct(null); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !sourceLoading && !sourceImporting && !sourceSavingMedia && !repairingImported) {
                  event.preventDefault();
                  void analyzeSourceCatalog();
                }
              }}
              placeholder="https://proveedor.com/categoria/productos/"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={sourceLoading || sourceImporting || sourceSavingMedia || repairingImported}
            />
            <button
              type="button"
              onClick={analyzeSourceCatalog}
              disabled={sourceLoading || sourceImporting || sourceSavingMedia || repairingImported || !sourceUrl.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {sourceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {sourceLoading ? "Analizando..." : "Analizar página"}
            </button>
            <button
              type="button"
              onClick={repairImportedDrafts}
              disabled={sourceLoading || sourceImporting || sourceSavingMedia || repairingImported}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              title={sourceUrl.trim() ? "Repara borradores del proveedor indicado" : "Repara todos los borradores importados por URL"}
            >
              {repairingImported ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {repairingImported ? "Reparando..." : "Reparar borradores importados"}
            </button>
          </div>

          {savedSourceProduct && (
            <div role="status" className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-bold">{savedSourceProduct.outcome === "archived" ? "Ya existe en la Papelera" :
                savedSourceProduct.outcome === "existing" ? "Ya estaba importado" :
                savedSourceProduct.outcome === "updated" ? "Borrador actualizado" : "Producto guardado en el catálogo"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{savedSourceProduct.name} · ID: {savedSourceProduct.id} · {savedSourceProduct.status}</p>
              <button type="button" onClick={() => onOpenProduct(savedSourceProduct.id)}
                className="mt-3 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
                {savedSourceProduct.outcome === "archived" ? "Abrir en Papelera" : "Ver y editar este producto"}
              </button>
            </div>
          )}
          {sourceManual && (
            <div className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <p className="font-bold">El proveedor no permite importar automáticamente esta ficha</p>
              <p className="text-sm">{sourceManual.reason}</p>
              <p className="text-sm">Puedes crear un borrador privado. Aún NO es una integración de pedidos con AliExpress.</p>
              <a className="inline-block text-sm font-semibold underline" href={sourceManual.url} target="_blank" rel="noopener noreferrer">Abrir producto en la web del proveedor</a>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={sourceManualName} onChange={(event) => setSourceManualName(event.target.value)}
                  placeholder="Nombre REAL del producto" aria-label="Nombre del producto"
                  className="rounded-lg border border-amber-200 bg-white px-3 py-2.5" />
                <input type="number" min="0" step="0.01" value={sourceManualCost} onChange={(event) => setSourceManualCost(event.target.value)}
                  placeholder="Coste proveedor en EUR (opcional)" aria-label="Coste proveedor"
                  className="rounded-lg border border-amber-200 bg-white px-3 py-2.5" />
                <input type="url" value={sourceManualImage} onChange={(event) => setSourceManualImage(event.target.value)}
                  placeholder="URL directa de la foto (opcional)" aria-label="URL de fotografía"
                  className="md:col-span-2 rounded-lg border border-amber-200 bg-white px-3 py-2.5" />
              </div>
              <SupplierImportImages images={sourceManualUploadedImages} onChange={setSourceManualUploadedImages}
                onBusyChange={setSourceManualUploading} disabled={sourceManualSaving}/>
              <button type="button" onClick={() => void saveSourceManualDraft()}
                disabled={sourceManualSaving || sourceManualUploading || !sourceManualName.trim()}
                className="rounded-lg bg-amber-900 px-4 py-2.5 font-bold text-white disabled:opacity-50">
                {sourceManualSaving ? "Guardando…" : sourceManualUploading ? "Copiando fotos…" :
                  sourceManualUploadedImages.length || sourceManualImage.trim() ? "Guardar borrador con fotos" : "Guardar borrador SIN fotos"}
              </button>
              <p className="text-xs">Si no añades una imagen, quedará pendiente de fotografía. No se publicará ni realizará compras automáticas.</p>
            </div>
          )}
          {sourceProducts.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
              <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{sourceProducts.length} productos encontrados</p>
                  <p className="text-xs text-muted-foreground">{selectedSourceProducts.length} productos para borrador · {selectedSourceImageCount} fotos para Biblioteca</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Nada se selecciona automáticamente. Producto y foto se eligen por separado.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSourceIds(
                        sourceProducts.reduce<Record<string, boolean>>((selected, product) => {
                          selected[product.id] = true;
                          return selected;
                        }, {})
                      )
                    }
                    disabled={sourceImporting || sourceSavingMedia}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    Seleccionar productos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSourceIds({})}
                    disabled={sourceImporting || sourceSavingMedia}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    Quitar productos
                  </button>
                  <button
                    type="button"
                    onClick={saveSelectedSourceMedia}
                    disabled={sourceImporting || sourceSavingMedia || !selectedSourceImageCount}
                    className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {sourceSavingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {sourceSavingMedia
                      ? "Guardando fotos " + sourceProgress.done + "/" + sourceProgress.total
                      : "Solo guardar " + selectedSourceImageCount + " foto" + (selectedSourceImageCount === 1 ? "" : "s") + " (NO crea producto)"}
                  </button>
                  <button
                    type="button"
                    onClick={importSelectedSourceProducts}
                    disabled={sourceImporting || sourceSavingMedia || !selectedSourceProducts.length}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {sourceImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {sourceImporting
                      ? "Importando " + sourceProgress.done + "/" + sourceProgress.total
                      : "Importar " + selectedSourceProducts.length + " seleccionados"}
                  </button>
                </div>
              </div>

              <div className="max-h-[520px] divide-y divide-border overflow-y-auto">
                {sourceProducts.map((product) => (
                  <div key={product.id} className="grid grid-cols-[auto_72px_1fr] gap-3 p-3 hover:bg-muted/30 sm:grid-cols-[auto_84px_1fr_auto] sm:items-start">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedSourceIds[product.id])}
                      onChange={(event) =>
                        setSelectedSourceIds((current) => ({ ...current, [product.id]: event.target.checked }))
                      }
                      disabled={sourceImporting || sourceSavingMedia}
                      className="mt-2 h-4 w-4 sm:mt-0"
                    />
                    <div className="h-16 w-[72px] overflow-hidden rounded-xl border border-border bg-muted sm:h-20 sm:w-[84px]">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">Sin foto</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{product.name}</p>
                      {product.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                          {product.department || product.category || "Catálogo"}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                          {productImageUrls(product).length} fotos
                        </span>
                      </div>
                      {productImageUrls(product).length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-[10px] font-bold text-muted-foreground">Marca solo las fotos que quieras guardar o usar:</p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {productImageUrls(product).map((url, index) => {
                              const key = sourceImageKey(product, url);
                              const checked = Boolean(selectedSourceImages[key]);
                              return (
                                <label key={key} className={"relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 bg-muted " + (checked ? "border-primary" : "border-border")}>
                                  <img src={url} alt={product.name + " " + (index + 1)} className="h-full w-full object-contain" />
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={sourceImporting || sourceSavingMedia}
                                    onChange={(event) =>
                                      setSelectedSourceImages((current) => ({ ...current, [key]: event.target.checked }))
                                    }
                                    className="absolute left-1 top-1 h-4 w-4"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="col-start-3 text-right text-[10px] text-muted-foreground sm:col-start-auto">
                      {product.sourceHost}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Usa esta opción únicamente con catálogos cuyas imágenes y datos tengas permiso para reutilizar.
          </p>
        </div>
    </section>
  );
}
