import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, GitBranch, RefreshCw, Server } from "lucide-react";
import { compareDeploymentVersions } from "../../../../shared/deploymentParity.js";

type DeploymentInfo = {
  commit?: string | null;
  platform?: string;
  builtAt?: string;
};

type CheckState = {
  frontend: DeploymentInfo | null;
  backend: DeploymentInfo | null;
  error: string | null;
};

async function readVersion(path: string): Promise<DeploymentInfo> {
  const response = await fetch(path + "?t=" + Date.now(), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("HTTP " + response.status + " (" + path + ")");
  const data = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Respuesta inválida de " + path);
  }
  return data;
}

export function DeploymentParityStatus() {
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<CheckState>({ frontend: null, backend: null, error: null });
  const verify = useCallback(async () => {
    setBusy(true);
    try {
      const [frontend, backend] = await Promise.all([
        readVersion("/herencia-deploy.json"),
        readVersion("/api/runtime-version"),
      ]);
      setCheck({ frontend, backend, error: null });
    } catch (error) {
      setCheck({
        frontend: null,
        backend: null,
        error: error instanceof Error ? error.message : "No se pudo confirmar el despliegue",
      });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void verify(); }, [verify]);

  const result = compareDeploymentVersions(check.frontend, check.backend);
  const ready = result.synced && !check.error;
  const drift = result.state === "drift";
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4" aria-label="Sincronización de publicación">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold">
            <GitBranch className="h-5 w-5 text-primary" /> Estado de publicación
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            GitHub main es la fuente de código. Vercel publica la web y Railway ejecuta la API.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => void verify()}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> {busy ? "Comprobando…" : "Verificar versiones"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-3">
          <div className="flex gap-2 items-center text-sm font-medium"><GitBranch className="h-4 w-4" /> Web / frontend</div>
          <p className="mt-1 font-mono text-sm">{result.frontendCommit?.slice(0, 12) || "Sin identificar"}</p>
          <p className="text-xs text-muted-foreground">{check.frontend?.platform || "Vercel o Railway"}</p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="flex gap-2 items-center text-sm font-medium"><Server className="h-4 w-4" /> API / backend</div>
          <p className="mt-1 font-mono text-sm">{result.backendCommit?.slice(0, 12) || "Sin identificar"}</p>
          <p className="text-xs text-muted-foreground">{check.backend?.platform || "Railway"}</p>
        </div>
      </div>
      <div className={"rounded-xl border p-3 text-sm " +
        (ready ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900")}
        role="status">
        <div className="flex items-center gap-2 font-semibold">
          {ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {busy ? "Comprobando compilaciones…" : ready ? "Frontend y backend en el mismo commit" :
            drift ? "Desfase detectado entre web y API" : "Sincronización sin verificar"}
        </div>
        <p className="mt-1 text-xs">
          {check.error ? "Error: " + check.error :
            ready ? "Coinciden las versiones publicadas. Antes de lanzar una nueva función, comprueba también las pruebas y los pagos." :
            drift ? "Una plataforma está en una revisión diferente. No declares completada la publicación hasta actualizar la plataforma atrasada." :
            "READY por sí solo no garantiza que la web y la API tengan el mismo código."}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Esta verificación es de solo lectura. No cambia DNS, pedidos, pagos ni configuraciones.
      </p>
    </section>
  );
}
