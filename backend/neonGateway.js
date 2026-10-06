import http from "node:http";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import {
  neonReady, readNeonStorageValue, readNeonStorageValues, upsertNeonStorageValue, deleteNeonStorageValue,
  listNeonOrders, patchNeonOrder,
  recordNeonAnalyticsEvent, getNeonAnalyticsSummary,
  listNeonCommerceCollections, listNeonCommerceProducts, getNeonCommerceProduct,
  bootstrapNeonCommerceFromLegacy, saveNeonCommerceProduct, saveNeonCommerceCollection, setNeonCommerceCollectionProducts, archiveNeonCommerceProduct
} from "./neonDb.js";
import {
  hasR2,
  r2ConfigStatus,
  listR2Media,
  uploadR2Media,
  uploadR2MediaBuffer,
  deleteR2Media,
  checkR2Connection,
} from "./r2Media.js";

const publicPort = Number(process.env.PORT || 3001);
const legacyPort = Number(process.env.LEGACY_BACKEND_PORT || 3002);
const legacyUrl = `http://127.0.0.1:${legacyPort}`;

const publicKeys = new Set(["chatboxSettings","herenciaSettings","customTheme","menuIcons","stripeSettings","shippingSettings","bouquetCatalog","heroBanner","ctaBanner","siteContent","businessSuiteSettings","marketingContent","communityContent"]);
const protectedKeys = new Set(["chatboxSettings","herenciaSettings","customTheme","menuIcons","stripeSettings","supabaseSettings","shippingSettings","aiSettings","tpvLayoutSettings","posCustomers","posFiscalSettings","posCashSession","adminProducts","adminSuppliers","adminFlowerCosts","bouquetCatalog","adminLatestFlowerQuote","heroBanner","ctaBanner","siteContent","siteContentDraft","siteContentHistory","herencia_finance_sales","herencia_finance_expenses","herencia_finance_closures","financeGoals","businessSuiteSettings","marketingContent","communityContent","__backendStorage_test__"]);
const adminOnly = ["supabaseSettings","aiSettings","heroBanner","ctaBanner","adminFlowerCosts","adminLatestFlowerQuote","tpvLayoutSettings","posCustomers","posFiscalSettings","posCashSession","adminSuppliers","siteContentDraft","siteContentHistory","herencia_finance_sales","herencia_finance_expenses","herencia_finance_closures","businessSuiteSettings","automationRules","adminAutomationNotifications","customerAccounts","customerReferrals"];

function json(res,status,body){if(res.headersSent||res.writableEnded)return res;if(!res.destroyed){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}return res;}
function cookies(req){return String(req.headers.cookie||"");}
function visitorId(req,res){const match=cookies(req).match(/(?:^|;\s*)visitor_id=([^;]+)/);if(match)return decodeURIComponent(match[1]);const id=crypto.randomUUID();res.setHeader("Set-Cookie",`visitor_id=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`);return id;}
function storageKey(req,res,key){return key==="cart"||key==="user"?`visitor:${visitorId(req,res)}:${key}`:key;}
function sanitize(key,value,isAdmin){if(!value)return value;try{if(key==="aiSettings"){const p=JSON.parse(value);return JSON.stringify({...p,apiKey:isAdmin?(p.apiKey?"••••••••":""):""});}if(key==="supabaseSettings"){const p=JSON.parse(value);return JSON.stringify({...p,serviceRoleKey:""});}}catch{}return value;}
function decodeHeaderValue(value){try{return decodeURIComponent(String(value||"").replace(/\+/g," "));}catch{return String(value||"");}}
function referrerHost(value){try{return new URL(String(value||"")).hostname.replace(/^www\./,"");}catch{return "";}}
function deviceFromUserAgent(value){const ua=String(value||"").toLowerCase();if(/ipad|tablet/.test(ua))return "Tablet";if(/mobi|android|iphone/.test(ua))return "Móvil";return "Ordenador";}
function browserFromUserAgent(value){const ua=String(value||"");if(/Edg\//.test(ua))return "Edge";if(/OPR\//.test(ua))return "Opera";if(/Chrome\//.test(ua)&&!/Edg\//.test(ua))return "Chrome";if(/Safari\//.test(ua)&&!/Chrome\//.test(ua))return "Safari";if(/Firefox\//.test(ua))return "Firefox";return "Otro";}

function normalizeOrderRow(order){
  return {
    id:String(order.id),
    customerName:order.customer_name||"Cliente",
    customerEmail:order.customer_email||"",
    items:Array.isArray(order.items)?order.items:[],
    subtotal:Number(order.subtotal||0),
    shipping:Number(order.shipping||0),
    total:Number(order.total||0),
    paymentMethod:order.payment_method||"manual",
    deliveryMethod:order.delivery_method||"envio",
    status:order.status||"pending",
    date:order.created_at||order.updated_at||new Date().toISOString(),
    metadata:order.metadata||{},
    stripePaymentIntentId:order.stripe_payment_intent_id||null,
    trackingEstado:order.tracking_estado||null,
    trackingTiempo:order.tracking_tiempo||null,
    facturaUrl:order.factura_url||null,
    entregaEstimada:order.entrega_estimada||null,
  };
}
async function adminSession(req){try{const r=await fetch(`${legacyUrl}/api/admin/session`,{headers:{cookie:cookies(req)}});return r.ok&&Boolean((await r.json()).authenticated);}catch{return false;}}
async function bodyBuffer(req,{maxBytes=8*1024*1024}={}){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>maxBytes){const error=new Error("Payload demasiado grande");error.statusCode=413;throw error;}chunks.push(c);}return Buffer.concat(chunks);}
async function bodyJson(req){const raw=await bodyBuffer(req);if(!raw.length)return {};return JSON.parse(raw.toString("utf8"));}
async function proxy(req,res){const chunks=[];for await(const c of req)chunks.push(c);const headers={...req.headers,host:`127.0.0.1:${legacyPort}`};delete headers["content-length"];const r=await fetch(`${legacyUrl}${req.url}`,{method:req.method,headers,body:["GET","HEAD"].includes(req.method)?undefined:Buffer.concat(chunks),redirect:"manual"});res.writeHead(r.status,Object.fromEntries(r.headers.entries()));if(r.body){for await(const c of r.body)res.write(c);}res.end();}
async function normalizeProductMedia(input={}){
  const next={...input};
  const sourceImages=Array.isArray(input.images)&&input.images.length?input.images:(input.image?[input.image]:[]);
  const normalized=[];
  for(let i=0;i<sourceImages.length;i++){
    const item=sourceImages[i];
    const url=typeof item==="string"?item:item?.url;
    if(!url)continue;
    if(/^data:image\//i.test(String(url))){
      if(!hasR2)throw Object.assign(new Error("Las imágenes incrustadas requieren Cloudflare R2. Sube la imagen desde la biblioteca multimedia."),{statusCode:503});
      const media=await uploadR2Media({dataUrl:String(url),filename:`${String(input.name||"producto")}-${i+1}`});
      normalized.push(typeof item==="string"?media.url:{...item,url:media.url,path:media.path});
    }else{
      normalized.push(item);
    }
  }
  next.images=normalized.slice(0,8);
  next.image=next.images.length?(typeof next.images[0]==="string"?next.images[0]:next.images[0]?.url||""):"";
  if(Array.isArray(next.variants)){
    next.variants=[];
    for(const variant of input.variants){
      const copy={...variant};
      if(/^data:image\//i.test(String(copy.image||""))){
        if(!hasR2)throw Object.assign(new Error("Las imágenes de variantes incrustadas requieren Cloudflare R2."),{statusCode:503});
        const media=await uploadR2Media({dataUrl:String(copy.image),filename:`${String(input.name||"producto")}-variante`});
        copy.image=media.url;
      }
      next.variants.push(copy);
    }
  }
  return next;
}

const child=spawn(process.execPath,["--import","./commerceCore.js","--import","./customerAccessRoutes.js","--import","./googleOAuthRoutes.js","--import","./fixCors.js","--import","./fixAdminEmail.js","--import","./fixAIBouquet.js","--import","./fixSalesAI.js","--import","./fixTTS.js","--import","./fixMapsShipping.js","server.js"],{stdio:"inherit",env:{...process.env,PORT:String(legacyPort)}});
child.on("exit",code=>{console.error(`Legacy backend exited (${code})`);process.exit(code??1);});

const server=http.createServer(async(req,res)=>{try{
  const path=new URL(req.url,"http://localhost").pathname;
  if(path==="/api/health"&&req.method==="GET"){let neon=false;try{neon=await neonReady();}catch{}return json(res,200,{ok:true,service:"Herencia hybrid gateway",neon,legacy:true});}
  if(path==="/api/ready"&&req.method==="GET"){
    let neon=false;try{neon=await neonReady();}catch{}
    const ready={
      ok:Boolean(neon),
      database:Boolean(neon),
      databasePrimary:"neon",
      legacySupabase:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY),
      stripe:Boolean(process.env.STRIPE_SECRET_KEY),
      stripeWebhook:Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      email:Boolean(process.env.RESEND_API_KEY),
      maps:Boolean(process.env.GOOGLE_MAPS_API_KEY),
      salesAi:Boolean(process.env.GROQ_API_KEY),
      imageAi:Boolean(
        process.env.GEMINI_API_KEY||
        process.env.GOOGLE_API_KEY||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY
      ),
      mediaProvider:hasR2?"cloudflare_r2":"legacy_supabase",
      r2Configured:hasR2,
    };
    return json(res,neon?200:503,ready);
  }
  if(path==="/api/analytics/visit"&&req.method==="POST"){
    const body=await bodyJson(req);
    const allowedEvents=new Set([
      "pageview",
      "space_preview",
      "sales_open",
      "sales_message",
      "sales_recommendation",
      "sales_photo_search",
      "sales_bouquet_generated",
      "sales_add_to_cart",
      "sales_buy_now",
      "sales_handoff",
      "sales_purchase"
    ]);
    const eventType=String(body?.eventType||"pageview");
    if(!allowedEvents.has(eventType))return json(res,400,{error:"Evento de analítica no válido"});
    const id=visitorId(req,res);
    const referrer=String(body?.referrer||"").slice(0,700);
    const userAgent=String(req.headers["user-agent"]||"");
    await recordNeonAnalyticsEvent({
      visitorId:id,
      sessionId:String(body?.sessionId||"").slice(0,120),
      eventType,
      eventLabel:String(body?.eventLabel||"").slice(0,240),
      productId:String(body?.productId||"").slice(0,180),
      amount:Math.max(0,Number(body?.amount||0)),
      metadata:body?.metadata&&typeof body.metadata==="object"?body.metadata:{},
      path:String(body?.path||"/").slice(0,500),
      referrer,
      referrerHost:referrerHost(referrer),
      country:decodeHeaderValue(req.headers["x-vercel-ip-country"]||req.headers["cf-ipcountry"]||body?.country||""),
      region:decodeHeaderValue(req.headers["x-vercel-ip-country-region"]||body?.region||""),
      city:decodeHeaderValue(req.headers["x-vercel-ip-city"]||body?.city||""),
      timezone:String(body?.timezone||"").slice(0,120),
      language:String(body?.language||"").slice(0,80),
      device:String(body?.device||deviceFromUserAgent(userAgent)).slice(0,80),
      browser:String(body?.browser||browserFromUserAgent(userAgent)).slice(0,120),
    });
    return json(res,202,{ok:true});
  }
  if(path==="/api/admin/analytics"&&req.method==="GET"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    const url=new URL(req.url,"http://localhost");
    const summary=await getNeonAnalyticsSummary(url.searchParams.get("days")||30);
    return json(res,200,{...summary,source:"neon"});
  }
  if(path==="/api/admin/sales/health"&&req.method==="GET"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    await bootstrapNeonCommerceFromLegacy();
    const products=await listNeonCommerceProducts({includeArchived:true});
    const active=products.filter((product)=>product?.active!==false&&!product?.deletedAt&&String(product?.status||"active")!=="archived");
    const sellable=active.filter((product)=>product?.trackInventory===false||Number(product?.stock||0)>0||(Array.isArray(product?.variants)&&product.variants.some((variant)=>Number(variant?.stock||0)>0)));
    let flowers=[];try{const raw=await readNeonStorageValue("bouquetCatalog");flowers=JSON.parse(raw||"[]");if(!Array.isArray(flowers))flowers=[];}catch{}
    return json(res,200,{
      ok:Boolean(process.env.GROQ_API_KEY)&&Boolean(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY),
      chat:{configured:Boolean(process.env.GROQ_API_KEY),model:process.env.GROQ_MODEL||"openai/gpt-oss-120b"},
      vision:{configured:Boolean(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY),legacyEnv:Boolean(!process.env.GEMINI_API_KEY&&!process.env.GOOGLE_API_KEY&&process.env.VITE_GEMINI_API_KEY),textModel:process.env.GEMINI_TEXT_MODEL||"gemini-2.5-flash",imageModel:process.env.GEMINI_IMAGE_MODEL||"gemini-2.5-flash-image"},
      media:{r2Configured:hasR2},
      limits:{
        chatPerMinute:Math.max(3,Number(process.env.SALES_AI_CHAT_LIMIT_PER_MINUTE||30)),
        imagePerMinute:Math.max(3,Number(process.env.SALES_AI_IMAGE_LIMIT_PER_MINUTE||12)),
        timeoutMs:Math.max(5000,Number(process.env.SALES_AI_TIMEOUT_MS||30000))
      },
      catalog:{total:products.length,active:active.length,sellable:sellable.length,outOfStock:Math.max(0,active.length-sellable.length)},
      flowers:{total:flowers.length,active:flowers.filter((flower)=>flower?.active!==false).length},
      source:"neon"
    });
  }

  if(path==="/api/admin/media/status"&&req.method==="GET"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    const config=r2ConfigStatus();
    const connection=hasR2?await checkR2Connection():{ok:false,configured:false};
    return json(res,200,{provider:hasR2?"cloudflare_r2":"legacy_supabase",...config,connection});
  }

  if(path==="/api/admin/media"&&hasR2){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    if(req.method==="GET"){
      const media=await listR2Media({limit:100});
      return json(res,200,{media,source:"cloudflare_r2"});
    }
    if(req.method==="POST"){
      const contentType=String(req.headers["content-type"]||"").split(";")[0].trim().toLowerCase();
      if(contentType.startsWith("image/") || contentType==="application/octet-stream"){
        const raw=await bodyBuffer(req);
        const filename=decodeURIComponent(String(req.headers["x-herencia-filename"]||"imagen"));
        const effectiveMime=contentType==="application/octet-stream"?"image/jpeg":contentType;
        const media=await uploadR2MediaBuffer({buffer:raw,mimeType:effectiveMime,filename});
        return json(res,200,{media,source:"cloudflare_r2"});
      }
      const body=await bodyJson(req);
      const media=await uploadR2Media({dataUrl:body?.dataUrl,filename:body?.filename});
      return json(res,200,{media,source:"cloudflare_r2"});
    }
    if(req.method==="DELETE"){
      const body=await bodyJson(req);
      await deleteR2Media(body?.path);
      return json(res,200,{ok:true,source:"cloudflare_r2"});
    }
    return json(res,405,{error:"Método no permitido"});
  }

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

  if(path==="/api/orders"&&req.method==="GET"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    const orders=(await listNeonOrders({limit:2000})).map(normalizeOrderRow);
    return json(res,200,{orders,source:"neon"});
  }

  const orderStatusMatch=path.match(/^\/api\/orders\/([^/]+)\/status$/);
  if(orderStatusMatch&&req.method==="PATCH"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    const body=await bodyJson(req);
    const status=String(body?.status||"").trim();
    if(!status)return json(res,400,{error:"Estado obligatorio"});
    const allowed=new Set(["pending","payment_pending","pending_bizum_review","pending_manual_review","pending_transfer_review","pending_store_confirmation","paid","confirmed","preparing","processing","ready","delivered","completed","cancelled","refunded","payment_error","payment_canceled"]);
    if(!allowed.has(status))return json(res,400,{error:"Estado no válido"});
    const updated=await patchNeonOrder(decodeURIComponent(orderStatusMatch[1]),{status});
    if(!updated)return json(res,404,{error:"Pedido no encontrado"});
    return json(res,200,{order:normalizeOrderRow(updated),source:"neon"});
  }

  if(path==="/api/commerce/collections"&&req.method==="GET"){
    const url=new URL(req.url,"http://localhost");
    const includeArchived=url.searchParams.get("includeArchived")==="1" && await adminSession(req);
    const collections=await listNeonCommerceCollections({includeArchived});
    return json(res,200,{collections,source:"neon"});
  }

  if(path==="/api/commerce/products"&&req.method==="GET"){
    const url=new URL(req.url,"http://localhost");
    const collection=String(url.searchParams.get("collection")||"");
    const includeArchived=url.searchParams.get("includeArchived")==="1" && await adminSession(req);
    await bootstrapNeonCommerceFromLegacy();
    const products=await listNeonCommerceProducts({collection,includeArchived});
    return json(res,200,{products,source:"neon"});
  }

  const commerceProductMatch=path.match(/^\/api\/commerce\/products\/([^/]+)$/);
  if(commerceProductMatch&&req.method==="GET"){
    const isAdmin=await adminSession(req);
    const product=await getNeonCommerceProduct(decodeURIComponent(commerceProductMatch[1]),{includeArchived:isAdmin});
    if(!product)return json(res,404,{error:"Producto no encontrado"});
    if(!isAdmin&&(product.active===false||product.deletedAt))return json(res,404,{error:"Producto no encontrado"});
    return json(res,200,{product,source:"neon"});
  }

  if(path==="/api/admin/commerce/bootstrap"&&req.method==="POST"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    const result=await bootstrapNeonCommerceFromLegacy();
    const products=await listNeonCommerceProducts({includeArchived:true});
    return json(res,200,{ok:true,...result,products,source:"neon"});
  }

  if(path==="/api/admin/commerce/health"&&req.method==="GET"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    await bootstrapNeonCommerceFromLegacy();
    const [products,collections]=await Promise.all([
      listNeonCommerceProducts({includeArchived:true}),
      listNeonCommerceCollections()
    ]);
    return json(res,200,{ok:true,products:products.length,collections:collections.length,source:"neon"});
  }

  if(path==="/api/admin/commerce/collections"&&req.method==="POST"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    const body=await bodyJson(req);
    if(!String(body?.name||"").trim())return json(res,400,{error:"Nombre obligatorio"});
    const collections=await saveNeonCommerceCollection(body);
    return json(res,200,{collections,source:"neon"});
  }

  const commerceCollectionProductsMatch=path.match(/^\/api\/admin\/commerce\/collections\/([^/]+)\/products$/);
  if(commerceCollectionProductsMatch&&req.method==="PUT"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    const body=await bodyJson(req);
    const products=await setNeonCommerceCollectionProducts(
      decodeURIComponent(commerceCollectionProductsMatch[1]),
      Array.isArray(body?.productIds)?body.productIds:[]
    );
    return json(res,200,{products,source:"neon"});
  }

  if(path==="/api/admin/commerce/products"&&req.method==="POST"){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    const body=await bodyJson(req);
    if(!String(body?.name||"").trim())return json(res,400,{error:"El nombre es obligatorio"});
    const normalizedBody=await normalizeProductMedia(body);
    const product=await saveNeonCommerceProduct(normalizedBody);
    return json(res,201,{product,source:"neon"});
  }

  const adminCommerceProductMatch=path.match(/^\/api\/admin\/commerce\/products\/([^/]+)$/);
  if(adminCommerceProductMatch){
    if(!(await adminSession(req)))return json(res,401,{error:"Acceso de administrador requerido"});
    const id=decodeURIComponent(adminCommerceProductMatch[1]);
    if(req.method==="PATCH"){
      const current=await getNeonCommerceProduct(id,{includeArchived:true});
      if(!current)return json(res,404,{error:"Producto no encontrado"});
      const body=await bodyJson(req);
      const normalizedBody=await normalizeProductMedia({...current,...body,id});
      const product=await saveNeonCommerceProduct(normalizedBody,{id});
      return json(res,200,{product,source:"neon"});
    }
    if(req.method==="DELETE"){
      const url=new URL(req.url,"http://localhost");
      await archiveNeonCommerceProduct(id,{permanent:url.searchParams.get("permanent")==="1"});
      return json(res,200,{ok:true,source:"neon"});
    }
  }

  return await proxy(req,res);
}catch(error){console.error("Hybrid gateway error",error);if(res.headersSent||res.writableEnded){if(!res.writableEnded&&!res.destroyed)res.destroy(error);return;}const status=Number(error?.statusCode||500);return json(res,status,{error:status>=500?"Hybrid gateway error":"Solicitud no válida",message:error?.message||String(error)});}});

server.listen(publicPort,"0.0.0.0",async()=>{
  console.log(`Herencia hybrid gateway listening on ${publicPort}; legacy backend on ${legacyPort}`);
  if(hasR2){
    const status=await checkR2Connection({verifyWrite:true});
    if(status.ok) console.log(`[r2] read/write OK bucket=${status.bucket}`);
    else console.error(`[r2] read/write FAILED code=${status.code||"unknown"} error=${status.error||"unknown"}`);
  }else{
    console.warn("[r2] not configured");
  }
});
process.on("SIGTERM",()=>{child.kill("SIGTERM");server.close(()=>process.exit(0));});
