import { useEffect, useState } from "react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type AdminUser = {
  id: string; username: string; role: string; state: string;
  email?: string | null; legacy?: boolean; mustChangePassword?: boolean;
};

export function AdminUsersManager({ previewOnly = false, ownerOnly = false }: { previewOnly?: boolean; ownerOnly?: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const reload = async () => {
    if (previewOnly) return;
    setLoading(true);
    try { setUsers((await backendApi.adminAccounts()).users); }
    catch (e: any) { setError(e?.message || "No se pudieron consultar las cuentas"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [previewOnly]);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (previewOnly || !ownerOnly) return;
    setCreating(true); setError("");
    try {
      await backendApi.adminCreateAccount(username, password);
      setUsername(""); setPassword("");
      toast.success("Cuenta creada. La contraseña debe cambiarse en el primer acceso.");
      await reload();
    } catch (e: any) { setError(e?.message || "No se pudo crear la cuenta"); }
    finally { setCreating(false); }
  };
  const manage = async (user: AdminUser, action: "status" | "role" | "reset_password", value: string) => {
    if (previewOnly || !ownerOnly || user.legacy || busyId) return;
    setBusyId(user.id); setError("");
    try {
      await backendApi.adminManageAccount(user.id, action, value);
      toast.success("Cuenta actualizada");
      setResetFor(null); setResetPassword("");
      await reload();
    } catch(e: any) { setError(e?.message || "No se pudo actualizar la cuenta"); }
    finally { setBusyId(null); }
  };
  return <div className="max-w-4xl space-y-6">
    <header>
      <h3 className="text-xl font-bold">Usuarios y permisos</h3>
      <p className="text-sm text-muted-foreground mt-1">Cada administrador tiene un usuario y contraseña independientes.</p>
    </header>
    {!ownerOnly && !previewOnly && <p role="status">Solo el propietario puede gestionar cuentas.</p>}
    {previewOnly && <p role="status">En la vista de demostración no se pueden gestionar cuentas.</p>}
    {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-900">{error}</p>}
    <section className="rounded-2xl border border-border bg-card p-5">
      <h4 className="font-semibold mb-4">Administradores existentes</h4>
      {loading ? <p>Cargando cuentas…</p> : (
        <div className="space-y-3">
          {users.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0">
            <div><p className="font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground">{user.role === "owner" ? "Administrador principal" : "Administrador"} · {user.mustChangePassword ? "Cambio de contraseña pendiente" : "Activo"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs rounded-lg bg-muted px-3 py-1">{user.legacy ? "Cuenta principal" : user.state}</span>
              {!user.legacy && !previewOnly && ownerOnly && <>
                <select aria-label={`Rol de ${user.username}`} disabled={busyId===user.id} value={user.role} onChange={e=>void manage(user,"role",e.target.value)} className="rounded-lg border p-2 text-sm bg-background">
                  <option value="admin">Administrador</option><option value="employee">Empleado</option>
                </select>
                <button type="button" disabled={busyId===user.id} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void manage(user,"status",user.state==="disabled"?"active":"disabled")}>{user.state==="disabled"?"Reactivar":"Suspender"}</button>
                <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setResetFor(resetFor===user.id?null:user.id)}>Restablecer clave</button>
              </>}
            </div>
            {resetFor===user.id && <div className="flex gap-2 flex-wrap w-full"><input aria-label="Contraseña provisional" type="password" autoComplete="new-password" minLength={4} value={resetPassword} onChange={e=>setResetPassword(e.target.value)} className="border rounded-lg p-2" placeholder="Nueva contraseña provisional"/><button type="button" disabled={busyId===user.id || resetPassword.length<4} onClick={()=>void manage(user,"reset_password",resetPassword)} className="rounded-lg border px-3 py-2">Confirmar restablecimiento</button></div>}
          </div>)}
        </div>
      )}
    </section>
    <form onSubmit={create} className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h4 className="font-semibold">Dar de alta un administrador</h4>
      <label className="block text-sm font-medium">Nombre de usuario
        <input autoComplete="off" required minLength={3} maxLength={32} pattern="[a-zA-Z][a-zA-Z0-9._-]*" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" />
      </label>
      <label className="block text-sm font-medium">Contraseña provisional
        <input autoComplete="new-password" type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" />
      </label>
      <p className="text-xs text-muted-foreground">La contraseña provisional solo permite configurar una nueva contraseña. Si hay verificación en dos pasos, también se solicitará al entrar.</p>
      <button disabled={creating || previewOnly || !ownerOnly} type="submit" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">
        {creating ? "Creando…" : "Crear administrador"}
      </button>
    </form>
  </div>;
}

export function AdminPasswordChange({ mandatory = false, onChanged, onLogout, legacy = false }: {
  mandatory?: boolean; onChanged: () => void; onLogout?: () => void; legacy?: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  if (legacy) return <div className="max-w-xl rounded-2xl border border-border bg-card p-6">
    <h3 className="font-bold text-lg">Contraseña de la cuenta principal</h3>
    <p className="mt-3 text-sm text-muted-foreground">Esta cuenta todavía utiliza las credenciales seguras configuradas en el servidor. Cambia ADMIN_PASSWORD desde la configuración privada del backend.</p>
  </div>;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword !== repeatedPassword) return setError("Las contraseñas nuevas no coinciden.");
    if (newPassword.length < 12) return setError("La nueva contraseña debe tener al menos 12 caracteres.");
    setSubmitting(true);
    try {
      await backendApi.adminChangePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setRepeatedPassword("");
      toast.success("Contraseña cambiada correctamente");
      onChanged();
    } catch (e: any) { setError(e?.message || "No se pudo cambiar la contraseña"); }
    finally { setSubmitting(false); }
  };
  return <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
    <h3 className="text-xl font-bold">{mandatory ? "Configura tu contraseña para continuar" : "Cambiar contraseña"}</h3>
    <p className="mb-5 mt-2 text-sm text-muted-foreground">{mandatory ? "Por seguridad, debes sustituir la contraseña provisional antes de usar el panel." : "Actualiza la contraseña de tu cuenta."}</p>
    {!mandatory && <button type="button" onClick={async()=>{ try { await backendApi.adminRevokeTrustedDevice(); toast.success("Este dispositivo volverá a solicitar OTP al iniciar sesión"); } catch(e:any) { toast.error(e?.message || "No se pudo revocar el dispositivo"); } }} className="mb-4 rounded-lg border border-border px-4 py-2 text-sm">Revocar confianza de este dispositivo</button>}
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      <label className="block text-sm font-medium">Contraseña actual o provisional
        <input autoComplete="current-password" type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" />
      </label>
      <label className="block text-sm font-medium">Nueva contraseña (mínimo 12 caracteres)
        <input autoComplete="new-password" type="password" minLength={12} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" />
      </label>
      <label className="block text-sm font-medium">Confirmar nueva contraseña
        <input autoComplete="new-password" type="password" minLength={12} required value={repeatedPassword} onChange={e => setRepeatedPassword(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3" />
      </label>
      <button disabled={submitting} type="submit" className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">
        {submitting ? "Guardando…" : "Guardar nueva contraseña"}
      </button>
    </form>
    {mandatory && onLogout && <button onClick={onLogout} className="mt-4 w-full text-sm text-muted-foreground underline">Cerrar sesión</button>}
  </div>;
}
