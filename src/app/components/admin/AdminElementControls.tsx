import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";

type ElementControlsProps = {
  label: string;
  visible?: boolean;
  onToggle: (visible: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
};

export function AdminElementControls({
  label,
  visible = true,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
  moveUpDisabled,
  moveDownDisabled,
}: ElementControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8e0] bg-white p-2">
      <label className="mr-auto flex cursor-pointer items-center gap-2 text-xs font-bold text-[#244a35]">
        <input
          type="checkbox"
          checked={visible}
          aria-label={`Mostrar ${label}`}
          onChange={(event) => onToggle(event.target.checked)}
        />
        {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        {visible ? "ON · Visible" : "OFF · Oculto"}
      </label>
      {onMoveUp && (
        <button type="button" onClick={onMoveUp} disabled={moveUpDisabled} aria-label={`Subir ${label}`} title="Subir" className="rounded-lg border p-1.5 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
      )}
      {onMoveDown && (
        <button type="button" onClick={onMoveDown} disabled={moveDownDisabled} aria-label={`Bajar ${label}`} title="Bajar" className="rounded-lg border p-1.5 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
      )}
      {onDuplicate && (
        <button type="button" onClick={onDuplicate} aria-label={`Duplicar ${label}`} title="Duplicar" className="rounded-lg border p-1.5"><Copy className="h-4 w-4" /></button>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Eliminar ${label}`} title="Eliminar" className="rounded-lg border border-red-200 p-1.5 text-red-700"><Trash2 className="h-4 w-4" /></button>
      )}
    </div>
  );
}

export function AdminAddElement({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <button type="button" onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#315b42] px-3 py-2 text-sm font-bold text-[#244a35] hover:bg-[#edf4ee]">
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}

export function reorderItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const reordered = items.slice();
  const [item] = reordered.splice(from, 1);
  reordered.splice(to, 0, item);
  return reordered;
}

export type AdminPublicationWindow = { startAt?: string; endAt?: string };

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function AdminScheduleFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: AdminPublicationWindow;
  onChange: (value: AdminPublicationWindow) => void;
}) {
  const setTime = (key: keyof AdminPublicationWindow, input: string) => {
    const parsed = input ? new Date(input) : null;
    if (input && (!parsed || Number.isNaN(parsed.getTime()))) return;
    onChange({ ...(value || {}), [key]: parsed ? parsed.toISOString() : undefined });
  };
  return (
    <details className="rounded-lg border border-dashed border-[#dde4da] p-2">
      <summary className="cursor-pointer text-xs font-bold text-[#3b5c47]">Programar publicación de {label}</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium">Desde
          <input type="datetime-local" value={toLocalInput(value?.startAt)} onChange={(event) => setTime("startAt", event.target.value)} className="mt-1 block w-full rounded-lg border p-2" />
        </label>
        <label className="text-xs font-medium">Hasta
          <input type="datetime-local" value={toLocalInput(value?.endAt)} onChange={(event) => setTime("endAt", event.target.value)} className="mt-1 block w-full rounded-lg border p-2" />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-[#607365]">Usa la hora local de este dispositivo; se guarda con zona horaria para que sea igual para todos los visitantes.</p>
      {value?.startAt && value?.endAt && Date.parse(value.startAt) >= Date.parse(value.endAt) ? (
        <p role="alert" className="mt-1 text-xs font-bold text-red-700">La fecha final debe ser posterior a la inicial. Este elemento no se publicará mientras las fechas sean inválidas.</p>
      ) : null}
    </details>
  );
}
