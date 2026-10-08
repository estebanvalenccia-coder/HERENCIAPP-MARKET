import { useEffect, useState } from "react";
import { backendStorage } from "../../lib/backendStorage";

export function AdminEasyCareToggle() {
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    const val = backendStorage.getItem("easyCareSectionEnabled");
    setEnabled(val !== "false");
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    backendStorage.setItem("easyCareSectionEnabled", String(next));
    // Notify other components that the flag changed
    window.dispatchEvent(new Event("backend-storage"));
  };

  return (
    <div className="flex items-center gap-2">
      <label className="font-black">Mostrar sección “Plantas fáciles de cuidar”</label>
      <input type="checkbox" checked={enabled} onChange={toggle} className="h-4 w-4" />
    </div>
  );
}
