import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, LockKeyhole, RefreshCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type AuditItem = {
  id: string;
  at: string;
  actor: string;
  action: string;
  previousRevision?: string;
  nextRevision?: string;
  subject?: string;
};
type Permission = { username: string; canPublish: boolean; canRestore: boolean; canViewAudit: boolean };

export function AdminSiteAuditPanel() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restricted, setRestricted] = useState<Permission[]>([]);
  const [ownerAccess, setOwnerAccess] = useState(false);
  const [username, setUsername] = useState("");
  const [flags, setFlags] = useState({ canPublish: true, canRestore: true, canViewAudit: true });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await backendApi.getSitePublicationAudit(50);
      setItems(response.items || []);
    } catch (cause: any) {
      setError(cause?.message || "No se pudo consultar la auditoría");
    } finally { setLoading(false); }

    // Only the owner role can see and modify restrictions. Do not expose policy
    // records or account details to other roles.
    try {
      const response = await backendApi.listSiteEditorRestrictions();
      setRestricted(response.items || []);
      setOwnerAccess(true);
    } catch {
      setOwnerAccess(false);
      setRestricted([]);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const chooseAccount = (name: string) => {
    setUsername(name);
    const item = restricted.find((entry) => entry.username === name);
    setFlags({
      canPublish: item?.canPublish !== false,
      canRestore: item?.canRestore !== false,
      canViewAudit: item?.canViewAudit !== false,
    });
  };

  const save = async () => {
    if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) {
      toast.error("Escribe un usuario de administración válido"); return;
    }
    if (!window.confirm(`¿Actualizar permisos de publicación de «${username}»? No cambiará su contraseña ni su rol.`)) return;
    setSaving(true);
    try {
      await backendApi.setSiteEditorRestrictions(username, flags);
      toast.success("Permisos guardados y auditados");
      await refresh();
    } catch (cause:any) { toast.error(cause?.message || "No se pudieron cambiar los permisos"); }
    finally { setSaving(false); }
  };

  return (
    <section className="rounded-2xl border border-[#dce6dc] bg-white p-5" aria-label="Auditoría de la administración">
      <div className="mb-4 flex items-center gap-3">
        <ClipboardCheck className="h-5 w-5 text-[#315b42]" />
        <div className="flex-1">
          <h4 className="font-black">Auditoría permanente de publicaciones</h4>
          <p className="text-xs text-muted-foreground">Registro de acciones en Neon. No contiene borradores privados ni contraseñas.</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="rounded-lg border p-2" aria-label="Actualizar auditoría">
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>
      {loading && <p className="text-xs text-muted-foreground">Cargando movimientos…</p>}
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{error}</p>}
      {!error && !loading && items.length === 0 && <p className="rounded-lg bg-[#f5f8f4] p-3 text-xs">Aún no hay movimientos registrados desde la activación de este historial.</p>}
      {items.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-xl border">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead><tr className="border-b bg-[#f5f8f4]"><th className="p-3">Fecha</th><th className="p-3">Administrador</th><th className="p-3">Acción</th><th className="p-3">Revisión</th></tr></thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="p-3">{new Date(entry.at).toLocaleString("es-ES", { timeZone:"Europe/Madrid" })}</td>
                  <td className="p-3 font-bold">{entry.actor}</td>
                  <td className="p-3">{entry.action === "restore" ? "Restauración" : entry.action === "permissions" ? `Permisos · ${entry.subject || ""}` : "Publicación"}</td>
                  <td className="p-3 font-mono">{entry.nextRevision?.slice(0,12) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ownerAccess && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-3 flex items-start gap-2">
            <LockKeyhole className="mt-0.5 h-4 w-4 text-emerald-900" />
            <div>
              <h5 className="text-sm font-black">Restricciones por administrador · solo propietario</h5>
              <p className="text-xs text-emerald-900/80">Puedes retirar permisos al rol admin. El rol empleado no puede publicar, aunque estos interruptores estén activos.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <label className="text-xs font-bold">Usuario de administración
              <input value={username} onChange={(event) => chooseAccount(event.target.value.toLowerCase().trim())}
                placeholder="usuario" className="mt-1 block w-full rounded-lg border bg-white p-2.5" />
            </label>
            <label className="text-xs font-bold">Restricciones guardadas
              <select value={restricted.some((item) => item.username === username) ? username : ""}
                onChange={(event) => chooseAccount(event.target.value)}
                className="mt-1 block w-full rounded-lg border bg-white p-2.5">
                <option value="">Seleccionar existente</option>
                {restricted.map((item) => <option key={item.username} value={item.username}>{item.username}</option>)}
              </select>
            </label>
          </div>
          <div className="my-4 flex flex-wrap gap-4">
            {([
              ["canPublish", "Publicar"],
              ["canRestore", "Restaurar versiones"],
              ["canViewAudit", "Ver auditoría"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={flags[key]} onChange={(event) => setFlags({ ...flags, [key]:event.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <button type="button" disabled={saving || !username} onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#315b42] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
            <Save className="h-4 w-4" /> Guardar restricciones
          </button>
        </div>
      )}
    </section>
  );
}
