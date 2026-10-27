import type { StorefrontComponentDesign } from "../../lib/componentRegistry";
import { normalizeComponentDesign } from "../../lib/componentDesignPolicy.mjs";

const specs: Array<{ key: keyof StorefrontComponentDesign; label: string; min: number; max: number; initial: number; unit: string }> = [
  { key: "paddingY", label: "Espaciado vertical", min: 0, max: 140, initial: 32, unit: "px" },
  { key: "marginY", label: "Margen exterior", min: 0, max: 100, initial: 0, unit: "px" },
  { key: "radius", label: "Redondeo", min: 0, max: 80, initial: 24, unit: "px" },
  { key: "headingSize", label: "Título", min: 14, max: 90, initial: 34, unit: "px" },
  { key: "minHeight", label: "Altura mínima", min: 0, max: 900, initial: 240, unit: "px" },
  { key: "maxWidth", label: "Anchura máxima", min: 320, max: 1600, initial: 1180, unit: "px" },
];

export function AdminUniversalDesignFields({
  label,
  design,
  onChange,
}: {
  label: string;
  design?: StorefrontComponentDesign;
  onChange: (value: StorefrontComponentDesign) => void;
}) {
  const current = normalizeComponentDesign(design);
  const patch = (part: Partial<StorefrontComponentDesign>) => onChange({ ...current, ...part });
  const updateColor = (key: "backgroundColor" | "textColor", value: string) => patch({ [key]: value });
  return (
    <details className="rounded-xl border border-[#dce6dc] bg-white p-3" open>
      <summary className="cursor-pointer text-sm font-black">Diseño · {label}</summary>
      <p className="mt-2 text-xs text-slate-500">Solo cambian los atributos que ajustes. Puedes restablecer el diseño original en cualquier momento.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(["backgroundColor", "textColor"] as const).map((key) => (
          <label key={key} className="text-xs font-bold">
            {key === "backgroundColor" ? "Fondo" : "Color del texto"}
            <div className="mt-2 flex items-center gap-2">
              <input type="color" value={current[key] || (key === "backgroundColor" ? "#ffffff" : "#173126")}
                onChange={(event) => updateColor(key, event.target.value)} className="h-9 w-14 cursor-pointer rounded" />
              <button type="button" onClick={() => {
                const next = { ...current }; delete next[key]; onChange(next);
              }} className="rounded-lg border px-2 py-1 text-xs font-semibold">Original</button>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 space-y-4">
        {specs.map((spec) => {
          const active = typeof current[spec.key] === "number";
          const value = active ? Number(current[spec.key]) : spec.initial;
          return (
            <label key={spec.key} className="block text-xs font-bold">
              <span className="flex items-center justify-between gap-2">
                {spec.label}
                <span>{active ? `${value}${spec.unit}` : "Sin personalizar"}</span>
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input type="range" min={spec.min} max={spec.max} value={value}
                  onChange={(event) => patch({ [spec.key]: Number(event.target.value) })}
                  className="w-full" />
                <button type="button" onClick={() => {
                  const next = { ...current }; delete next[spec.key]; onChange(next);
                }} className="rounded-lg border px-2 py-1 text-xs font-semibold">↺</button>
              </div>
            </label>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">Familia tipográfica
          <select className="mt-1 w-full rounded-xl border bg-white p-2" value={current.fontFamily || "inherit"}
            onChange={(event) => patch({ fontFamily: event.target.value as StorefrontComponentDesign["fontFamily"] })}>
            <option value="inherit">Heredada</option><option value="sans">Sans</option><option value="serif">Serif</option>
          </select>
        </label>
        <label className="text-xs font-bold">Sombra
          <select className="mt-1 w-full rounded-xl border bg-white p-2" value={current.shadow || "none"}
            onChange={(event) => patch({ shadow: event.target.value as StorefrontComponentDesign["shadow"] })}>
            <option value="none">Sin sombra</option><option value="small">Suave</option>
            <option value="medium">Media</option><option value="large">Intensa</option>
          </select>
        </label>
        <label className="text-xs font-bold">Animación
          <select className="mt-1 w-full rounded-xl border bg-white p-2" value={current.animation || "none"}
            onChange={(event) => patch({ animation: event.target.value as StorefrontComponentDesign["animation"] })}>
            <option value="none">Sin animación</option><option value="fade-in">Aparecer</option>
            <option value="slide-up">Subir suavemente</option>
          </select>
        </label>
      </div>
      <button type="button" onClick={() => onChange({})}
        className="mt-4 w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-800">
        Restablecer diseño original
      </button>
    </details>
  );
}
