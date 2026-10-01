import http from "node:http";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { neonReady, readNeonStorageValue, readNeonStorageValues, upsertNeonStorageValue, deleteNeonStorageValue } from "./neonDb.js";

const publicPort = Number(process.env.PORT || 3001);
const legacyPort = Number(process.env.LEGACY_BACKEND_PORT || 3002);
const legacyUrl = `http://127.0.0.1:${legacyPort}`;

const publicKeys = new Set(["chatboxSettings","herenciaSettings","customTheme","menuIcons","stripeSettings","shippingSettings","adminProducts","heroBanner","ctaBanner","siteContent","businessSuiteSettings","marketingContent"]);
const protectedKeys = new Set(["chatboxSettings","herenciaSettings","customTheme","menuIcons","stripeSettings","supabaseSettings","shippingSettings","aiSettings","tpvLayoutSettings","posCustomers","posFiscalSettings","posCashSession","adminProducts","adminSuppliers","adminFlowerCosts","adminLatestFlowerQuote","heroBanner","ctaBanner","siteContent","siteContentDraft","siteContentHistory","herencia_finance_sales","herencia_finance_expenses","herencia_finance_closures","financeGoals","businessSuiteSettings","marketingContent","__backendStorage_test__"]);
const adminOnly = ["supabaseSettings","aiSettings","heroBanner","ctaBanner","adminFlowerCosts","adminLatestFlowerQuote","tpvLayoutSettings","posCustomers","posFiscalSettings","posCashSession","adminSuppliers","siteContentDraft","siteContentHistory","herencia_finance_sales","herencia_finance_expenses","herencia_finance_closures","businessSuiteSettings","automationRules","adminAutomationNotifications","customerAccounts","customerReferrals"];

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}
function cookies(req){return String(req.headers.cookie||"");}
function visitorId(req,res){const match=cookies(req).match(/(?:^|;\s*)visitor_id=([^;]+)/);if(match)return decodeURIComponent(match[1]);const id=crypto.randomUUID();res.setHeader("Set-Cookie",`visitor_id=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=None; Secure`);return id;}
function storageKey(req,res,key){return key==="cart"||key==="user"?`visitor:${visitorId(req,res)}:${key}`:key;}
function sanitize(key,value,isAdmin){if(!value)return value;try{if(key==="aiSettings"){const p=JSON.parse(value);return JSON.stringify({...p,apiKey:isAdmin?(p.apiKey?"••••••••":""):""});}if(key==="supabaseSettings"){const p=JSON.parse(value);return JSON.stringify({...p,serviceRoleKey:""});}}catch{}return value;}
async function adminSession(req){try{const r=await fetch(`${legacyUrl}/api/admin/session`,{headers:{cookie:cookies(req)}});return r.ok&&Boolean((await r.json()).authenticated);}catch{return false;}}
async function bodyJson(req){const chunks=[];for await(const c of req)chunks.push(c);if(!chunks.length)return {};return JSON.parse(Buffer.concat(chunks).toString("utf8"));}
async function proxy(req,res){const chunks=[];for await(const c of req)chunks.push(c);const headers={...req.headers,host:`127.0.0.1:${legacyPort}`};delete headers["content-length"];const r=await fetch(`${legacyUrl}${req.url}`,{method:req.method,headers,body:["GET","HEAD"].includes(req.method)?undefined:Buffer.concat(chunks),redirect:"manual"});res.writeHead(r.status,Object.fromEntries(r.headers.entries()));if(r.body){for await(const c of r.body)res.write(c);}res.end();}

const child=spawn(process.execPath,["--import","./commerceCore.js","--import","./customerAccessRoutes.js","--import","./fixCors.js","--import","./fixAdminEmail.js","--import","./fixAIBouquet.js","--import","./fixSalesAI.js","--import","./fixTTS.js","--import","./fixMapsShipping.js","server.js"],{stdio:"inherit",env:{...process.env,PORT:String(legacyPort)}});
child.on("exit",code=>{console.error(`Legacy backend exited (${code})`);process.exit(code??1);});

const server=http.createServer(async(req,res)=>{try{
  const path=new URL(req.url,"http://localhost").pathname;
  if(path==="/api/health"&&req.method==="GET"){let neon=false;try{neon=await neonReady();}catch{}return json(res,200,{ok:true,service:"Herencia hybrid gateway",neon,legacy:true});}
  if(path==="/api/ready"&&req.method==="GET"){let neon=false;try{neon=await neonReady();}catch{}if(neon)return json(res,200,{ok:true,database:true,databasePrimary:"neon",legacySupabase:true,stripe:Boolean(process.env.STRIPE_SECRET_KEY)});}
  if(path==="/api/storage"&&req.method==="GET"){
    const isAdmin=await adminSession(req);const keys=[...publicKeys];if(isAdmin)keys.push(...adminOnly);const id=visitorId(req,res);keys.push(`visitor:${id}:cart`,`visitor:${id}:user`);
    const rows=await readNeonStorageValues(keys);const data={};for(const row of rows){let key=row.key;if(key.startsWith(`visitor:${id}:`))key=key.split(":").pop();data[key]=sanitize(key,row.value,isAdmin);}return json(res,200,{data,source:"neon"});
  }
  const storageMatch=path.match(/^\/api\/storage\/([^/]+)$/);
  if(storageMatch){const key=decodeURIComponent(storageMatch[1]);const isAdmin=await adminSession(req);if(protectedKeys.has(key)&&!publicKeys.has(key)&&!isAdmin)return json(res,401,{error:"Acceso de administrador requerido"});const dbKey=storageKey(req,res,key);
    if(req.method==="GET"){const value=await readNeonStorageValue(dbKey);return json(res,200,{value:sanitize(key,value,isAdmin),source:"neon"});}
    if(req.method==="PUT"){if(protectedKeys.has(key)&&!isAdmin)return json(res,401,{error:"Acceso de administrador requerido"});if(!protectedKeys.has(key)&&key!=="cart"&&key!=="user")return json(res,403,{error:"Clave no permitida"});const body=await bodyJson(req);await upsertNeonStorageValue(dbKey,body.value);return json(res,200,{ok:true,source:"neon"});}
    if(req.method==="DELETE"){if(protectedKeys.has(key)&&!isAdmin)return json(res,401,{error:"Acceso de administrador requerido"});await deleteNeonStorageValue(dbKey);return json(res,200,{ok:true,source:"neon"});}
  }
  if(path==="/api/settings/public"&&req.method==="GET"){
    const keys=["chatboxSettings","herenciaSettings","customTheme","menuIcons","stripeSettings","shippingSettings","heroBanner","ctaBanner","siteContent","businessSuiteSettings","marketingContent"];
    const rows=await readNeonStorageValues(keys);const settings={};for(const row of rows){const safe=sanitize(row.key,row.value,false);try{settings[row.key]=JSON.parse(safe);}catch{settings[row.key]=safe;}}return json(res,200,{settings,source:"neon"});
  }
  return await proxy(req,res);
}catch(error){console.error("Hybrid gateway error",error);return json(res,500,{error:"Hybrid gateway error",message:error?.message||String(error)});}});

server.listen(publicPort,"0.0.0.0",()=>console.log(`Herencia hybrid gateway listening on ${publicPort}; legacy backend on ${legacyPort}`));
process.on("SIGTERM",()=>{child.kill("SIGTERM");server.close(()=>process.exit(0));});
