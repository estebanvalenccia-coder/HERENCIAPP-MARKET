import type { SiteLink } from "../../lib/siteContent";
import { AdminAddElement, AdminElementControls, AdminScheduleFields, reorderItem } from "./AdminElementControls";

/** Recursive model, bounded at 8 levels to prevent unusable or cyclic public navigation. */
export function AdminNestedMenuEditor({
  links, onChange, depth = 1,
}: {
  links: SiteLink[];
  onChange: (links: SiteLink[]) => void;
  depth?: number;
}) {
  const patch = (index: number, values: Partial<SiteLink>) =>
    onChange(links.map((item, i) => i === index ? { ...item, ...values } : item));
  return (
    <div className="space-y-2">
      {links.map((item, index) => (
        <details key={index} className="rounded-lg border border-[#e1e9df] bg-[#f8fbf8] p-2" open={depth <= 2 ? true : undefined}>
          <summary className="cursor-pointer text-xs font-black">{item.label || "Nuevo subenlace"} · nivel {depth}</summary>
          <div className="mt-2 space-y-3">
            <AdminElementControls label={item.label || "Subenlace"} visible={item.visible !== false}
              onToggle={(visible) => patch(index,{visible})}
              onMoveUp={() => onChange(reorderItem(links,index,index-1))}
              onMoveDown={() => onChange(reorderItem(links,index,index+1))}
              moveUpDisabled={index===0} moveDownDisabled={index===links.length-1}
              onDuplicate={() => onChange([...links.slice(0,index+1), JSON.parse(JSON.stringify(item)), ...links.slice(index+1)])}
              onRemove={() => onChange(links.filter((_,i)=>i!==index))}
            />
            <label className="block text-xs font-bold">Texto
              <input value={item.label||""} onChange={(event)=>patch(index,{label:event.target.value})}
                className="mt-1 w-full rounded-lg border bg-white p-2" />
            </label>
            <label className="block text-xs font-bold">Destino
              <input value={item.href||""} onChange={(event)=>patch(index,{href:event.target.value})}
                className="mt-1 w-full rounded-lg border bg-white p-2" />
            </label>
            <label className="block text-xs font-bold">Descripción
              <input value={item.description||""} onChange={(event)=>patch(index,{description:event.target.value})}
                className="mt-1 w-full rounded-lg border bg-white p-2" />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.showDesktop!==false} onChange={(event)=>patch(index,{showDesktop:event.target.checked})} />Ordenador</label>
              <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.showMobile!==false} onChange={(event)=>patch(index,{showMobile:event.target.checked})} />Móvil</label>
            </div>
            <AdminScheduleFields label={item.label} value={item.schedule} onChange={(schedule)=>patch(index,{schedule})} />
            {depth < 8 && (
              <div className="border-l-2 border-emerald-200 pl-3">
                <p className="mb-2 text-xs font-bold">Subcategorías de {item.label || "este enlace"}</p>
                <AdminNestedMenuEditor links={item.children||[]} onChange={(children)=>patch(index,{children})} depth={depth+1} />
              </div>
            )}
          </div>
        </details>
      ))}
      {depth <= 8 && <AdminAddElement label={depth===1?"Añadir subenlace": "Añadir subcategoría"} onAdd={() =>
        onChange([...links,{label:"Nuevo enlace",href:"/productos",visible:false}])} />}
    </div>
  );
}
