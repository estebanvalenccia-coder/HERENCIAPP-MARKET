/**
 * Printful Sync Products API (read-only). Never sends orders or writes to Printful.
 * The sync variant ID identifies a store item; variant_id identifies its blank catalog item.
 */
const API = "https://api.printful.com";
const fail=(message,statusCode=422)=>{const error=new Error(message);error.statusCode=statusCode;throw error;};
const id=x=>String(x??"").trim();
const money=x=> x!=null && x!=="" && Number.isFinite(Number(x)) && Number(x)>=0 ? Number(x) : null;
const imageUrl=x=>{const v=String(x||"");try{const u=new URL(v);return u.protocol==="https:"?v:"";}catch{return "";}};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function normalizePrintfulSyncProduct(response,{storeId="",existingVariants=[]}={}){
 const syncProduct=response?.result?.sync_product;
 const rows=response?.result?.sync_variants;
 if(!syncProduct||!id(syncProduct.id)||!Array.isArray(rows)||!rows.length)
   fail("Printful no devolvió un producto sincronizado con variantes completas.",502);
 if(rows.length>500)fail("Más de 500 variantes: no se guardará un catálogo incompleto.",422);
 const existing=new Map((existingVariants||[]).filter(v=>v?.printfulSyncVariantId).map(v=>[id(v.printfulSyncVariantId),v]));
 const seen=new Set();
 const variants=rows.map(v=>{
   const syncId=id(v?.id),catalogId=id(v?.variant_id);
   if(!syncId||!catalogId||seen.has(syncId))fail("Printful devolvió variantes sin ID o duplicadas.",502);
   seen.add(syncId);
   const previous=existing.get(syncId);
   const catalog=v?.product && typeof v.product==="object"?v.product:{};
   const parts=id(v?.name).split(" / ").map(x=>x.trim()).filter(Boolean);
   const color=id(catalog.color||v.color||(parts.length>=3?parts[parts.length-2]:""));
   const size=id(catalog.size||v.size||(parts.length>=3?parts[parts.length-1]:""));
   const label=[color,size].filter(Boolean).join(" / ")||id(v?.name);
   if(!label)fail("Printful devolvió una variante sin talla, color ni nombre.",502);
   const files=Array.isArray(v.files)?v.files:[];
   const image=imageUrl(v.preview_url)||imageUrl(files.find(f=>f?.preview_url)?.preview_url)||
     imageUrl(files.find(f=>f?.thumbnail_url)?.thumbnail_url)||imageUrl(syncProduct.thumbnail_url);
   const originalSku=id(v.sku);
   const synced=v.synced!==false && v.is_ignored!==true;
   const availability=id(v.availability_status||"unknown");
   const verified=synced && availability==="active";
   const retail=money(v.retail_price);
   return {
     name:label,optionValues:[color,size].filter(Boolean),sku:originalSku,
     supplierSku:originalSku,supplierVariantId:syncId,printfulSyncVariantId:syncId,
     printfulCatalogVariantId:catalogId,printfulAvailability:availability,
     printfulAvailabilityVerified:availability!=="unknown",printfulOnDemand:true,
     printfulRetailPriceUnverified:retail,
     stock:0,image,
     // Printful retail_price currency is not proven EUR for this store. Never silently convert.
     price:previous?.price!=null?previous.price:undefined,
     ...(previous?.price!=null?{manualPricePreserved:true}:{}),
     availabilityStatus:verified?"available":"unverified",
   };
 });
 if(new Set(variants.map(v=>v.name.toLowerCase())).size!==variants.length)
   fail("Printful devolvió combinaciones indistinguibles; no se reemplazarán las existentes.",422);
 if(Number(syncProduct.variants)>rows.length)fail("La respuesta de Printful está incompleta; no se eliminarán variantes.",502);
 return {syncProductId:id(syncProduct.id),storeId:id(storeId),name:id(syncProduct.name),
   image:imageUrl(syncProduct.thumbnail_url),variants,optionLabels:["Color","Talla"],
   inventoryMode:"printful_on_demand",checkedAt:new Date().toISOString()};
}

export async function printfulGet(path,{env=process.env,fetchImpl=fetch,wait=delay,storeId:requestedStoreId}={}){
 const token=id(env.PRINTFUL_API_TOKEN);
 if(!token)fail("Configura PRINTFUL_API_TOKEN en Railway.",503);
 const storeId=id(requestedStoreId||env.PRINTFUL_STORE_ID);
 if(storeId && !/^[0-9]+$/.test(storeId))fail("PRINTFUL_STORE_ID inválido.",422);
 const url=new URL(path,API);
 if(url.origin!==API)fail("Ruta Printful no autorizada.");
 for(let attempt=0;attempt<3;attempt++){
   let response;
   try{response=await fetchImpl(url.toString(),{headers:{
     Authorization:"Bearer "+token,...(storeId?{"X-PF-Store-Id":storeId}:{})
   },signal:AbortSignal.timeout(12000)});}catch{fail("No se pudo conectar con Printful. Los productos no se han modificado.",502);}
   if(response.status===429 || response.status>=500){
     if(attempt<2){await wait(300*(attempt+1));continue;}
     fail("Printful está ocupado o limita las solicitudes. Reintenta más tarde.",503);
   }
   if(response.status===401||response.status===403)fail("El token Printful no tiene acceso a productos sincronizados de esta tienda.",403);
   if(response.status===404)fail("Producto sincronizado no encontrado en la tienda Printful.",404);
   if(response.status===400)fail("Printful requiere un ID de tienda válido o permisos de lectura del catálogo.",422);
   if(!response.ok)fail("Printful rechazó la consulta de catálogo. No se modificaron datos.",502);
   let payload;try{payload=await response.json();}catch{fail("Respuesta Printful ilegible.",502);}
   if(payload?.code && Number(payload.code)>=400)fail("Printful no autorizó la consulta.",502);
   return payload;
 }
}

export async function listPrintfulStores(options={}){
 const stores=[];let offset=0;
 for(let page=0;page<20;page++){
   const payload=await printfulGet("/stores?limit=100&offset="+offset,{...options,storeId:""});
   if(!Array.isArray(payload?.result))fail("Printful no devolvió un listado de tiendas.",502);
   stores.push(...payload.result.map(item=>({id:id(item.id),name:id(item.name),type:id(item.type)})));
   if(payload.result.length<100)return stores;
   offset+=payload.result.length;
 }
 fail("Demasiadas tiendas para verificar.",422);
}
export async function listPrintfulSyncProducts(options={}){
 const rows=[];let offset=0;
 for(let page=0;page<20;page++){
   const payload=await printfulGet("/store/products?limit=100&offset="+offset,options);
   const pageRows=payload?.result;
   if(!Array.isArray(pageRows))fail("Listado Printful incompleto.",502);
   rows.push(...pageRows.map(p=>({id:id(p.id),name:id(p.name),variants:Number(p.variants||0),thumbnail:imageUrl(p.thumbnail_url)})));
   if(pageRows.length<100)return rows;
   offset+=pageRows.length;
 }
 fail("Listado de Printful demasiado grande para sincronizarlo completo.",422);
}

export async function getPrintfulSyncProduct(syncId,options={}){
 if(!/^[0-9]{1,20}$/.test(id(syncId)))fail("Selecciona un identificador de producto sincronizado Printful.");
 const payload=await printfulGet("/store/products/"+id(syncId),options);
 return normalizePrintfulSyncProduct(payload,{storeId:options.storeId || options.env?.PRINTFUL_STORE_ID || process.env.PRINTFUL_STORE_ID,existingVariants:options.existingVariants});
}
