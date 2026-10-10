import { useMemo, useState } from "react";
import { EU_COUNTRIES } from "../../lib/supplierMarketplace.js";

type Offer = { id: string; supplierId: string; product: string; freight: string; extras: string; days: string };
const eur = (amount: number) => new Intl.NumberFormat("es-ES", {
  style:"currency", currency:"EUR"
}).format(amount);
const makeRow = (id: string): Offer => ({
  id, supplierId:"", product:"", freight:"", extras:"0", days:"",
});
const amount = (s: string) => {
  const x = String(s || "").trim().replace(",", ".");
  return x !== "" && Number.isFinite(Number(x)) && Number(x) >= 0 ? Number(x) : null;
};

/** Indicative manual quotes only. Supplier API quotes must be checked by backend. */
export function AdminSupplierCostComparison({ suppliers = [] }: { suppliers?: any[] }) {
  const [country, setCountry] = useState("ES");
  const [postalCode, setPostalCode] = useState("");
  const [price, setPrice] = useState("19.90");
  const [vat, setVat] = useState("21");
  const [rows, setRows] = useState<Offer[]>([makeRow("first"),makeRow("second")]);
  const update = (id: string, key: keyof Offer, value: string) =>
    setRows(current => current.map(o => o.id === id ? { ...o, [key]:value } : o));
  const calculated = useMemo(() => {
    const sale = amount(price);
    const tax = amount(vat);
    const validPrice = sale !== null && sale > 0 && tax !== null && tax <= 40;
    const net = validPrice ? sale / (1 + tax / 100) : null;
    const options = rows.map(entry => {
      const product=amount(entry.product);
      const freight=amount(entry.freight);
      const extras=amount(entry.extras);
      const ready = Boolean(entry.supplierId && product !== null && freight !== null && extras !== null && net !== null);
      const total = ready ? Number(product) + Number(freight) + Number(extras) : null;
      const profit = total === null || net === null ? null : net - total;
      return { ...entry, total, profit, ready };
    });
    return {
      options,
      ranked:options.filter(o=>o.ready).sort((a,b)=>Number(a.total)-Number(b.total)),
      priceValid:validPrice,
    };
  },[rows,price,vat]);
  const options = Array.isArray(suppliers) ? suppliers.filter(s=>s?.active !== false) : [];
  const name = (id: string) => options.find(s=>String(s.id)===id)?.name || "Proveedor";

  return <section id="supplier-compare" className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
    <div className="space-y-2">
      <p className="text-sm font-bold uppercase tracking-wider text-primary">Comparar envíos a la Unión Europea</p>
      <h2 className="text-xl font-bold">Comparador de costes por proveedor</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Calcula qué proveedor ofrece el menor coste total para una unidad. Introduce solo
        presupuestos obtenidos del proveedor para la <strong>misma variante exacta</strong> y el
        mismo destino. Esta herramienta es una simulación manual: no consulta APIs, no verifica
        existencias, no modifica precios de venta y no crea pedidos.
      </p>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-semibold">País de destino
        <select value={country} onChange={e=>setCountry(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border bg-background p-3">
          {EU_COUNTRIES.map(c=><option value={c} key={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Código postal de destino
        <input value={postalCode} onChange={e=>setPostalCode(e.target.value.slice(0,16))}
          placeholder="Ej. 75001" className="mt-1 block w-full rounded-lg border border-border bg-background p-3"/>
      </label>
      <label className="text-sm font-semibold">Precio al cliente (€), con IVA
        <input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border bg-background p-3"/>
      </label>
      <label className="text-sm font-semibold">IVA estimado (%)
        <input type="number" min="0" max="40" value={vat} onChange={e=>setVat(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border bg-background p-3"/>
      </label>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">
      Consulta la normativa fiscal del país de destino antes de aplicar un porcentaje.
      Incluye en «Otros» comisiones, costes adicionales y una reserva de riesgo.
    </p>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {rows.map((entry,index)=><div key={entry.id} className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">Oferta {index+1}</h3>
          {rows.length>2 && <button type="button" className="text-xs text-destructive underline"
            onClick={()=>setRows(current=>current.filter(o=>o.id!==entry.id))}>Quitar</button>}
        </div>
        <label className="mt-3 block text-xs font-semibold">Proveedor
          <select value={entry.supplierId} onChange={e=>update(entry.id,"supplierId",e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5">
            <option value="">Elige un proveedor registrado</option>
            {options.map(s=><option value={String(s.id)} key={String(s.id)}>{s.name}</option>)}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([["product","Producto (€)"],["freight","Envío (€)"],["extras","Otros (€)"],["days","Entrega estimada (días)"]] as const).map(([key,label])=>
            <label className="text-xs font-semibold" key={key}>{label}
              <input type="number" min="0" step={key==="days"?"1":"0.01"}
                value={entry[key]} onChange={e=>update(entry.id,key,e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5"/>
            </label>
          )}
        </div>
        <p className="mt-3 text-sm">
          Coste total: <strong>{entry.supplierId && calculated.options[index]?.total!==null
            ? eur(Number(calculated.options[index].total)) : "Pendiente"}</strong>
        </p>
      </div>)}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={rows.length>=6}
        onClick={()=>setRows(current=>[...current,makeRow("manual-"+Date.now())])}
        className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">+ Añadir oferta</button>
      <button type="button" onClick={()=>setRows([makeRow("first"),makeRow("second")])}
        className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">Limpiar ofertas</button>
    </div>
    <div className="mt-4 rounded-xl border border-border bg-primary/5 p-4" aria-live="polite">
      {!calculated.priceValid ? <p className="text-sm font-semibold">Corrige el precio o el porcentaje de IVA.</p> :
      !postalCode.trim() ? <p className="text-sm font-semibold">Introduce el código postal para contextualizar las ofertas.</p> :
      !calculated.ranked.length ? <p className="text-sm font-semibold">Completa al menos una oferta para comparar.</p> :
      <>
        <p className="text-xs font-bold uppercase text-primary">Menor coste estimado (no verificado)</p>
        <p className="mt-1 text-lg font-bold">{name(calculated.ranked[0].supplierId)} · {eur(Number(calculated.ranked[0].total))}</p>
        <p className="text-sm">Beneficio estimado antes de otros gastos: {eur(Number(calculated.ranked[0].profit))}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {country} · {postalCode.trim()} · Solo una unidad. Para automatizar la compra,
          Herencia tendrá que volver a obtener cotizaciones y existencias verificadas desde las APIs autorizadas.
        </p>
      </>}
    </div>
  </section>;
}
