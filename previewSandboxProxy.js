// Same-origin proxy for unreviewed Neural branches: isolated demo backend ONLY.
const internalBackend="http://herencia-preview-sandbox.railway.internal:8080";
const previewHost=/^neural-preview-[a-f0-9]{32}-production\.up\.railway\.app$/i;
export async function proxySandboxApi(req,res){
 const host=String(req.headers.host||"").split(":")[0];
 const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-herencia-preview":"sandbox"};
 if(!previewHost.test(host)){res.writeHead(403,headers);res.end(JSON.stringify({error:"Preview domain not recognized"}));return;}
 const chunks=[];let size=0;
 for await(const part of req){size+=part.length;if(size>500000){res.writeHead(413,headers);res.end(JSON.stringify({error:"Demo request too large"}));return;}chunks.push(part)}
 try{
  const response=await fetch(internalBackend+(req.url||"/"),{
   method:req.method,headers:{"content-type":"application/json","x-preview-host":host},
   body:["GET","HEAD"].includes(req.method)?undefined:Buffer.concat(chunks),
   signal:AbortSignal.timeout(12000),redirect:"manual"
  });
  const content=await response.text();
  res.writeHead(response.status,{"content-type":response.headers.get("content-type")||"application/json","cache-control":"no-store","x-herencia-preview":"sandbox","x-robots-tag":"noindex, nofollow"});
  res.end(content);
 }catch{
  res.writeHead(503,headers);
  res.end(JSON.stringify({error:"El backend de demostración no está disponible. Producción permanece aislada.",sandbox:true}));
 }
}
