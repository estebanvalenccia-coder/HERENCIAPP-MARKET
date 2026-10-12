import { useEffect, useState } from "react";
import { EU_COUNTRIES } from "../../lib/supplierMarketplace.js";
import { backendApi } from "../../lib/backendStorage";

type PrintfulQuote = Awaited<ReturnType<typeof backendApi.quotePrintfulShipping>>;
type PrintfulStatus = Awaited<ReturnType<typeof backendApi.getPrintfulShippingStatus>>;

const money = (amount: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);

/**
 * Separate, non-order-capable provider quoting UI. Only numeric Printful catalog
 * variant IDs and EU delivery postcodes are transmitted to the Herencia server.
 * Never accept or expose bearer tokens, checkout data or customer identity.
 */
export function AdminProviderApiQuotes() {
  const [status, setStatus] = useState<PrintfulStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [variantId, setVariantId] = useState("");
  const [destination, setDestination] = useState("ES");
  const [postalCode, setPostalCode] = useState("");
  const [quote, setQuote] = useState<PrintfulQuote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncProducts,setSyncProducts]=useState<Array<{id:string;name:string;variants:number;thumbnail:string}>>([]);
  const [stores,setStores]=useState<Array<{id:string;name:string;type:string}>>([]);
  const [storeId,setStoreId]=useState("");
  const [syncProductId,setSyncProductId]=useState("");
  const [herenciaProductId,setHerenciaProductId]=useState("");
  const [printfulOrderId,setPrintfulOrderId]=useState("");
  const [printfulOrderBusy,setPrintfulOrderBusy]=useState(false);
  const [printfulOrderStatus,setPrintfulOrderStatus]=useState("");
  const [printfulOrderError,setPrintfulOrderError]=useState("");
  const checkOrder=async(createDraft:boolean)=>{
    if(!printfulOrderId.trim())return;
    setPrintfulOrderBusy(true);setPrintfulOrderError("");setPrintfulOrderStatus("");
    try{
      const response=createDraft?
        await backendApi.createPrintfulOrderDraft(printfulOrderId.trim()):
        await backendApi.checkPrintfulOrderStatus(printfulOrderId.trim());
      setPrintfulOrderStatus(response.externalOrderId?
        "ID Printful: "+response.externalOrderId+" · Estado: "+String(response.printfulStatus||response.status||"sin confirmar"):
        "Printful no encuentra todavía ese pedido. Comprueba si está pagado y tiene variantes vinculadas.");
    }catch(error:any){setPrintfulOrderError(error?.message||"No se pudo consultar el pedido de Printful");}
    finally{setPrintfulOrderBusy(false);}
  };
  const [syncBusy,setSyncBusy]=useState(false);
  const [syncError,setSyncError]=useState("");
  const [syncSuccess,setSyncSuccess]=useState("");
  const refreshSyncProducts=async()=>{
    setSyncBusy(true);setSyncError("");
    try{
      let selectedStore=storeId;
      if(!stores.length){
        const listing=await backendApi.listPrintfulStores();
        setStores(listing.stores);
        if(listing.stores.length===1){selectedStore=listing.stores[0].id;setStoreId(selectedStore);}
      }
      const result=await backendApi.listPrintfulSyncProducts(selectedStore);
      setSyncProducts(result.products);if(result.products.length===1)setSyncProductId(result.products[0].id);
    }catch(error:any){setSyncError(error?.message||"No se pudieron listar los productos Printful");}
    finally{setSyncBusy(false);}
  };
  const syncProduct=async()=>{
    if(!syncProductId)return;
    setSyncBusy(true);setSyncError("");setSyncSuccess("");
    try{const result=await backendApi.syncPrintfulProduct(syncProductId,herenciaProductId.trim()||undefined,storeId);
      setSyncSuccess("Guardadas "+result.variantCount+" variantes reales en Herencia. Producto: "+String(result.product.id)+". Revisa precios y publicación en Productos.");
    }catch(error:any){setSyncError(error?.message||"Printful no pudo sincronizar las variantes. La ficha anterior se conserva.");}
    finally{setSyncBusy(false);}
  };

  useEffect(() => {
    let active = true;
    backendApi.getPrintfulShippingStatus().then(result => {
      if (active) setStatus(result);
    }).catch((reason: any) => {
      if (active) setStatusError(String(reason?.message || "No se pudo consultar Printful."));
    });
    return () => { active = false; };
  }, []);

  const invalidate = () => { setQuote(null); setError(""); };
  const requestQuote = async () => {
    if (busy) return;
    if (!/^[1-9][0-9]{0,10}$/.test(variantId.trim())) {
      setError("Introduce un identificador numérico real de variante Printful.");
      return;
    }
    if (!postalCode.trim()) {
      setError("Introduce el código postal del destino antes de cotizar.");
      return;
    }
    setBusy(true);
    invalidate();
    try {
      const result = await backendApi.quotePrintfulShipping(
        Number(variantId.trim()), destination, postalCode.trim()
      );
      setQuote(result);
    } catch (failure: any) {
      setError(String(failure?.message || "Printful no pudo calcular el envío."));
    } finally {
      setBusy(false);
    }
  };

  return <section id="supplier-printful" className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
    <p className="text-sm font-bold uppercase tracking-wider text-primary">API oficial · Cotización en vivo</p>
    <h2 className="mt-1 text-xl font-black">Printful · Envíos a la Unión Europea</h2>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
      Consulta tarifas directamente en Printful para una variante de su catálogo y una unidad.
      Solo se solicitan país y código postal: <strong>no se crea ningún pedido ni se envían
      datos personales del comprador</strong>.
    </p>

    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3 text-sm">
      {status?.configured ? <p className="font-semibold text-emerald-800">
        Token de Printful detectado en Railway. La autorización se confirma al solicitar la tarifa.
      </p> : <p className="font-semibold text-amber-800">
        {status?.reason || statusError || "Comprobando configuración de Printful…"}
      </p>}
      <p className="mt-1 text-xs text-muted-foreground">
        Variables del backend: <code>PRINTFUL_API_TOKEN</code> y, para tokens de cuenta,
        <code className="ml-1">PRINTFUL_STORE_ID</code>. No escribas credenciales aquí.
        La conexión no activa pedidos automáticos.
      </p>
    </div>

    <div className="mt-5 rounded-xl border border-border p-4">
      <h3 className="font-bold">Catálogo sincronizado de Printful</h3>
      <p className="mt-1 text-xs text-muted-foreground">Obtén las camisetas y sus combinaciones reales directamente de tu tienda Printful. Los artículos nuevos se crean como borrador; los pedidos no se envían al proveedor desde aquí.</p>
      <button type="button" disabled={syncBusy} onClick={()=>void refreshSyncProducts()} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Consultar mis productos Printful</button>
      {stores.length>1&&<label className="mt-3 block text-xs font-bold">Tienda Printful
        <select value={storeId} onChange={e=>{setStoreId(e.target.value);setSyncProducts([]);setSyncProductId("");}} className="mt-1 w-full rounded-lg border bg-background p-2">
          <option value="">Selecciona tu tienda</option>
          {stores.map(store=><option key={store.id} value={store.id}>{store.name} · {store.id}</option>)}
        </select>
        <button type="button" disabled={syncBusy||!storeId} onClick={()=>void refreshSyncProducts()} className="mt-2 rounded-lg border px-3 py-2 text-xs font-semibold">Cargar esta tienda</button>
      </label>}
      {syncProducts.length>0&&<div className="mt-3 space-y-2">
        <label className="block text-xs font-bold">Producto sincronizado Printful
          <select value={syncProductId} onChange={e=>setSyncProductId(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2">
            <option value="">Selecciona un producto</option>
            {syncProducts.map(p=><option key={p.id} value={p.id}>{p.name} · {p.variants} variantes · #{p.id}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold">ID de la ficha Herencia existente (opcional)
          <input value={herenciaProductId} onChange={e=>setHerenciaProductId(e.target.value.trim())} placeholder="Déjalo vacío para importar como borrador nuevo" className="mt-1 w-full rounded-lg border bg-background p-2"/>
        </label>
        <button type="button" onClick={()=>void syncProduct()} disabled={syncBusy||!syncProductId} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Sincronizar variantes con Printful</button>
      </div>}
      {syncError&&<p role="alert" className="mt-2 text-sm font-semibold text-red-700">{syncError}</p>}
      {syncSuccess&&<p role="status" className="mt-2 text-sm font-semibold text-emerald-700">{syncSuccess}</p>}
    </div>

    <section className="mt-4 rounded-xl border border-border p-4" aria-label="Pedidos de Printful">
      <h3 className="font-bold">Pedidos Printful · preparación y seguimiento</h3>
      <p className="mt-1 text-xs text-muted-foreground">Al confirmar una compra de productos exclusivamente Printful, Herencia intenta crear automáticamente un pedido real en estado borrador. No se confirma la producción ni se cobra a Herencia hasta verificar el coste y autorizarlo.</p>
      <label className="mt-3 block text-xs font-bold">ID completo del pedido Herencia
        <input className="mt-1 w-full rounded-lg border bg-background p-2" value={printfulOrderId} onChange={event=>setPrintfulOrderId(event.target.value.trim())} placeholder="Referencia del pedido Herencia"/>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={printfulOrderBusy||!printfulOrderId} onClick={()=>void checkOrder(false)}
          className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50">Consultar pedido en Printful</button>
        <button type="button" disabled={printfulOrderBusy||!printfulOrderId} onClick={()=>void checkOrder(true)}
          className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50">Preparar borrador sin pagar</button>
      </div>
      {printfulOrderStatus&&<p role="status" className="mt-3 text-sm font-semibold">{printfulOrderStatus}</p>}
      {printfulOrderError&&<p role="alert" className="mt-3 text-sm font-semibold text-red-700">{printfulOrderError}</p>}
    </section>

    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <label className="text-sm font-semibold">ID de variante del catálogo Printful
        <input inputMode="numeric" value={variantId} onChange={e=>{setVariantId(e.target.value.replace(/[^0-9]/g,"").slice(0,11));invalidate();}}
          placeholder="Ej. 4011" className="mt-1 block w-full rounded-lg border border-border bg-background p-3"/>
      </label>
      <label className="text-sm font-semibold">País de destino
        <select value={destination} onChange={e=>{setDestination(e.target.value);invalidate();}}
          className="mt-1 block w-full rounded-lg border border-border bg-background p-3">
          {EU_COUNTRIES.map(country=><option key={country} value={country}>{country}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Código postal
        <input value={postalCode} onChange={e=>{setPostalCode(e.target.value.slice(0,16));invalidate();}}
          placeholder="Ej. 08032 o 75001" className="mt-1 block w-full rounded-lg border border-border bg-background p-3"/>
      </label>
    </div>
    <button type="button" onClick={()=>void requestQuote()} disabled={busy || status?.configured!==true}
      className="mt-4 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? "Consultando Printful…" : "Cotizar envío real (sin comprar)"}
    </button>

    {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">{error}</p>}
    {quote && <div className="mt-4 rounded-xl border border-border p-4" aria-live="polite">
      <p className="font-bold">Métodos de envío consultados · {quote.destination} {quote.postalCode}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Variante {quote.catalogVariantId} · 1 unidad · Consultado {new Date(quote.checkedAt).toLocaleString("es-ES")}
      </p>
      <div className="mt-3 space-y-2">
        {quote.methods.map(method=><div key={method.code} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{method.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {method.minDeliveryDays!==null && method.maxDeliveryDays!==null
                ? method.minDeliveryDays+"–"+method.maxDeliveryDays+" días orientativos"
                : "Plazo no confirmado"}
              {method.customsFeesPossible ? " · Posibles gastos de aduana" : ""}
            </p>
          </div>
          <p className="font-bold">{money(method.rateEur)}</p>
        </div>)}
      </div>
      <p className="mt-3 text-xs font-semibold text-amber-800">
        Solo se ha verificado el coste de transporte. NO se han comprobado el precio del producto,
        el stock ni el IVA final. Esta tarifa no habilita checkout, pedidos ni pagos automáticos.
        Actualiza la cotización antes de vender: Printful indica que las tarifas dinámicas pueden cambiar.
      </p>
    </div>}

    <div className="mt-5 border-t border-border pt-4">
      <h3 className="text-base font-bold">EPROLO · Acceso API pendiente de autorización</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        EPROLO entrega su documentación y acceso API a través del representante de soporte
        de la cuenta. Cuando estén disponibles se podrá implementar su propio adaptador,
        separado de CJ y Printful. No se simula aquí ningún endpoint no documentado.
      </p>
      <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold">
        <a href="https://eprolo.com/es/eprolo-api/" rel="noopener noreferrer" target="_blank" className="underline">Cómo solicitar la API EPROLO</a>
        <a href="https://developers.printful.com/docs/v2-preview/" rel="noopener noreferrer" target="_blank" className="underline">Documentación oficial de Printful</a>
      </div>
    </div>
  </section>;
}
