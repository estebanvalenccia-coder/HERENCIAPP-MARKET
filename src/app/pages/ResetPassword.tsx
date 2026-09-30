import { useState } from "react";
import { Lock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const token = params.get("token") || "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return toast.error("El enlace de recuperación no es válido");
    if (password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    try {
      setLoading(true);
      const response = await fetch("/api/customer/password/reset", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ token, password }) });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || "No se pudo cambiar la contraseña");
      toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
      navigate("/login", { replace:true });
    } catch (error:any) { toast.error(error?.message || "No se pudo cambiar la contraseña"); }
    finally { setLoading(false); }
  };

  return <div className="min-h-[75vh] flex items-center justify-center px-4 py-12"><div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-lg"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Lock/></div><h1 className="text-center text-2xl font-bold">Crear nueva contraseña</h1><p className="mt-2 text-center text-sm text-muted-foreground">Elige una contraseña nueva para tu cuenta de Herencia Market.</p><form onSubmit={submit} className="mt-7 space-y-4"><div><label className="mb-2 block text-sm font-medium">Nueva contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" placeholder="Mínimo 8 caracteres"/></div><div><label className="mb-2 block text-sm font-medium">Repetir contraseña</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} required className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" placeholder="Repite la contraseña"/></div><button disabled={loading || !token} className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{loading?"Guardando...":"Cambiar contraseña"}</button>{!token&&<p className="text-sm text-destructive">Falta el código de recuperación. Solicita un enlace nuevo desde Iniciar sesión.</p>}</form></div></div>;
}
