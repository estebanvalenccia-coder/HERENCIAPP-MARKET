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
