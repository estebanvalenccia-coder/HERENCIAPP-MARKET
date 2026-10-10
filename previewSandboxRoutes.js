import {read,write,remove,all,list} from "./previewSandboxStorage.js";
import {demoProducts,demoCollections,getDemoProducts,getDemoCollections,saveDemoProducts} from "./previewSandboxCatalog.js";
export async function body(req){
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>500000)throw Object.assign(Error("Data too large"),{status:413});chunks.push(chunk)}
 try{return chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{}}catch{throw Object.assign(Error("Invalid JSON"),{status:400})}
}
export async function handleSandboxApi(req,ns){
 const url=new URL(req.url,"http://localhost"),path=url.pathname,method=req.method;
 if(method==="GET"&&path==="/api/health")return {ok:true,sandbox:true};
 if(method==="GET"&&path==="/api/ready")return {ok:true,database:true,databasePrimary:"sandbox"};
 if(method==="GET"&&path==="/api/preview/mode")return {enabled:true,sandbox:true,readOnly:false,productionAccess:false};
 if(method==="GET"&&path==="/api/admin/session")return {authenticated:true,sandbox:true};
 if(method==="GET"&&path==="/api/admin/auth-config")return {totpRequired:false,sandbox:true};
 if(method==="POST"&&path==="/api/admin/logout")return {ok:true,sandbox:true};
 if(method==="GET"&&path==="/api/storage"){
  const data=await all(ns);if(!data.adminProducts)data.adminProducts=JSON.stringify(demoProducts);
  return {data,source:"sandbox"};
 }
 const key=path.match(/^\/api\/storage\/([A-Za-z0-9_:-]{1,120})$/)?.[1];
 if(key){
  if(method==="GET")return {value:(await read(ns,key))??(key==="adminProducts"?JSON.stringify(demoProducts):null)};
  if(method==="PUT"){const value=(await body(req)).value;await write(ns,key,String(value??""));return {ok:true,sandbox:true}}
  if(method==="DELETE"){await remove(ns,key);return {ok:true,sandbox:true}}
 }
 if(method==="GET"&&path==="/api/settings/public")return {settings:{},sandbox:true};
 if(method==="GET"&&path==="/api/commerce/categories")return {categories:await getDemoCollections(ns),source:"sandbox"};
 if(method==="GET"&&path==="/api/commerce/collections")return {collections:await getDemoCollections(ns),source:"sandbox"};
 if(method==="GET"&&path==="/api/commerce/products"){
  const products=await getDemoProducts(ns);
  const collection=url.searchParams.get("collection");
  return {products:collection?products.filter(x=>x.category===collection||x.collectionId===collection):products,source:"sandbox"};
 }
 if(method==="GET"&&path==="/api/admin/commerce/health"){
  return {ok:true,products:(await getDemoProducts(ns)).length,collections:(await getDemoCollections(ns)).length,source:"sandbox"};
 }
 const id=path.match(/^\/api\/(?:admin\/commerce|commerce)\/products\/([a-zA-Z0-9_-]+)$/)?.[1];
 if(method==="GET"&&id){const p=(await getDemoProducts(ns)).find(x=>String(x.id)===id);return {product:p||null,source:"sandbox"};}
 if(method==="POST"&&path==="/api/admin/commerce/products"){
  const product={...(await body(req)),id:"demo-"+Date.now(),active:true};const rows=await getDemoProducts(ns);
  await saveDemoProducts(ns,[...rows,product]);return {product,source:"sandbox"};
 }
 if(id&&method==="PATCH"){
  const rows=await getDemoProducts(ns),ix=rows.findIndex(x=>String(x.id)===id);
  if(ix<0)throw Object.assign(Error("Product not found"),{status:404});
  rows[ix]={...rows[ix],...(await body(req)),id};await saveDemoProducts(ns,rows);
  return {product:rows[ix],source:"sandbox"};
 }
 if(id&&method==="DELETE"){
  await saveDemoProducts(ns,(await getDemoProducts(ns)).filter(x=>String(x.id)!==id));
  return {ok:true,source:"sandbox"};
 }
 if(method==="POST"&&path==="/api/admin/commerce/collections"){
  const row={...(await body(req)),id:"demo-"+Date.now()};
  const rows=await getDemoCollections(ns);await write(ns,"previewCollections",JSON.stringify([...rows,row]));
  return {collections:[...rows,row],source:"sandbox"};
 }
 throw Object.assign(Error("No disponible en la administración de prueba; no se ha modificado producción"),{status:403});
}
