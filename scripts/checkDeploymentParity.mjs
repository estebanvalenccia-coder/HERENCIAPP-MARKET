// Read-only production parity audit. Does not deploy or perform paid/commerce actions.
import { writeFile } from "node:fs/promises";
import { compareDeploymentFleet } from "../shared/deploymentFleet.js";
const origins = {
  public: process.env.HERENCIA_SITE_URL || "https://www.herenciamarket.es",
  vercel: process.env.HERENCIA_VERCEL_DIRECT_URL || "https://herenciapp-market.vercel.app",
  railway: "https://herenciapp-frontend-production.up.railway.app",
  backend: "https://herenciapp-market-production.up.railway.app"
};
const hosts = {
  public: ["www.herenciamarket.es", "herenciamarket.es"],
  vercel: ["herenciapp-market.vercel.app"],
  railway: ["herenciapp-frontend-production.up.railway.app"],
  backend: ["herenciapp-market-production.up.railway.app"]
};
const paths = {public:"/herencia-deploy.json",vercel:"/herencia-deploy.json",railway:"/herencia-deploy.json",backend:"/api/runtime-version"};
async function query(name) {
  const origin = new URL(origins[name]);
  if(origin.protocol !== "https:" || !hosts[name].includes(origin.hostname) || origin.username || origin.password || origin.port || origin.pathname !== "/" || origin.search || origin.hash) throw Error("Unapproved origin");
  const url = new URL(paths[name], origin);
  url.searchParams.set("audit", String(Date.now()));
  const response = await fetch(url,{headers:{Accept:"application/json","Cache-Control":"no-cache"},signal:AbortSignal.timeout(12000),redirect:"error"});
  if(!response.ok) throw Error("HTTP "+response.status);
  const payload = await response.json();
  if(!payload || typeof payload !== "object") throw Error("Invalid JSON");
  return {ok:true,commit:payload.commit,platform:payload.platform};
}
const entries=await Promise.all(Object.keys(paths).map(async name=>{
  try{return [name,await query(name)];}
  catch(e){return [name,{ok:false,error:String(e?.message || e).slice(0,120)}];}
}));
const report=compareDeploymentFleet(Object.fromEntries(entries),process.env.HERENCIA_EXPECTED_SHA);
console.log("Herencia deployment audit",JSON.stringify(report,null,2));
if(process.env.HERENCIA_REPORT_PATH) await writeFile(process.env.HERENCIA_REPORT_PATH,JSON.stringify(report,null,2)+"\n",{mode:0o600});
if(!report.synced){console.error("Sincronización no verificada. No publicamos ni declaramos paridad.");process.exitCode=1;}
