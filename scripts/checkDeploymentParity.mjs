// Read-only production release check. Never alters DNS, payments or active deployments.
import { compareDeploymentVersions, normalizeCommit } from "../shared/deploymentParity.js";

const siteUrl = process.env.HERENCIA_SITE_URL || "https://www.herenciamarket.es";
const origin = new URL(siteUrl);
if (origin.protocol !== "https:" || !["www.herenciamarket.es", "herenciamarket.es"].includes(origin.hostname)) {
  throw new Error("Solo se permite comprobar el dominio público oficial HTTPS");
}
async function read(path) {
  const url = new URL(path, origin);
  url.searchParams.set("verify", String(Date.now()));
  const response = await fetch(url, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(12000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Error HTTP ${response.status} al leer ${path}`);
  const result = await response.json();
  if (!result || typeof result !== "object") throw new Error("Respuesta de versión inválida");
  return result;
}
try {
  const [front, backend] = await Promise.all([read("/herencia-deploy.json"), read("/api/runtime-version")]);
  const result = compareDeploymentVersions(front, backend);
  console.log("Frontend:", result.frontendPlatform, result.frontendCommit || "no verificable");
  console.log("API:", result.backendPlatform, result.backendCommit || "no verificable");
  console.log("Coordinación:", result.state);
  const expected = normalizeCommit(process.env.HERENCIA_EXPECTED_SHA);
  if (expected) console.log("GitHub main esperado:", expected);
  if (!result.synced || (expected && (result.frontendCommit !== expected || result.backendCommit !== expected))) {
    console.error("La web y la API deben coincidir entre sí Y con el commit esperado de GitHub main. Publicación incompleta.");
    process.exitCode = 1;
  }
} catch (error) {
  console.error("No se pudo confirmar la sincronización:", error.message);
  process.exitCode = 1;
}
