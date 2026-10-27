import type { MarketCardDesign, MarketPromoDesign } from "../../lib/marketExperience";

const positions = [
  ["center", "Centro"], ["top", "Arriba"], ["bottom", "Abajo"],
  ["left", "Izquierda"], ["right", "Derecha"],
] as const;

function NumericRange({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-bold">
      <span className="mb-1 flex items-center justify-between"><span>{label}</span><span>{value}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full" />
    </label>
  );
}

export function AdminCardDesignFields({
  label, value, onChange, defaultImageHeight = 176, defaultBackgroundColor = "#ffffff",
}: { label: string; value?: MarketCardDesign; onChange: (next: MarketCardDesign) => void; defaultImageHeight?: number; defaultBackgroundColor?: string }) {
  const patch = (update: Partial<MarketCardDesign>) => onChange({ ...(value || {}), ...update });
  return (
    <details className="rounded-xl border border-[#dce6dc] bg-white p-3">
      <summary className="cursor-pointer text-xs font-black">Diseño visual · {label}</summary>
      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold">Fondo
            <input type="color" value={value?.backgroundColor || defaultBackgroundColor} onChange={(event) => patch({ backgroundColor: event.target.value })} className="mt-1 block h-9 w-20 cursor-pointer" />
          </label>
          <label className="text-xs font-bold">Texto
            <input type="color" value={value?.textColor || "#173126"} onChange={(event) => patch({ textColor: event.target.value })} className="mt-1 block h-9 w-20 cursor-pointer" />
          </label>
        </div>
        <NumericRange label="Redondeo de esquinas (px)" min={0} max={48} value={value?.radius ?? 24} onChange={(radius) => patch({ radius })} />
        <NumericRange label="Altura de la imagen (px)" min={100} max={300} value={value?.imageHeight ?? defaultImageHeight} onChange={(imageHeight) => patch({ imageHeight })} />
        <label className="block text-xs font-bold">
          Posición de la imagen
          <select className="mt-1 block w-full rounded-lg border p-2" value={value?.imagePosition || "center"} onChange={(event) => patch({ imagePosition: event.target.value })}>
            {positions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
      </div>
    </details>
  );
}

export function AdminPromoDesignFields({
  value, onChange,
}: { value?: MarketPromoDesign; onChange: (next: MarketPromoDesign) => void }) {
  const patch = (update: Partial<MarketPromoDesign>) => onChange({ ...(value || {}), ...update });
  return (
    <details className="rounded-xl border border-[#dce6dc] bg-white p-3">
      <summary className="cursor-pointer text-xs font-black">Diseño del banner</summary>
      <div className="mt-3 space-y-3">
        <NumericRange label="Altura mínima (px)" min={240} max={620} value={value?.minHeight ?? 300} onChange={(minHeight) => patch({ minHeight })} />
        <NumericRange label="Esquinas (px)" min={0} max={48} value={value?.radius ?? 32} onChange={(radius) => patch({ radius })} />
        <NumericRange label="Intensidad del degradado (%)" min={0} max={100} value={value?.overlayOpacity ?? 100} onChange={(overlayOpacity) => patch({ overlayOpacity })} />
        <label className="block text-xs font-bold">Enfoque de la imagen
          <select className="mt-1 block w-full rounded-lg border p-2" value={value?.imagePosition || "center"} onChange={(event) => patch({ imagePosition: event.target.value })}>
            {positions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold">Alineación del contenido
          <select className="mt-1 block w-full rounded-lg border p-2" value={value?.textAlign || "left"} onChange={(event) => patch({ textAlign: event.target.value as "left" | "center" | "right" })}>
            <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
          </select>
        </label>
      </div>
    </details>
  );
}
