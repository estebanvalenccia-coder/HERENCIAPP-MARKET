import http from "node:http";
import {initialize,namespaceFromHost} from "./previewSandboxStorage.js";
import {handleSandboxApi} from "./previewSandboxRoutes.js";
if(process.env.RAILWAY_SERVICE_NAME!=="HERENCIA-PREVIEW-SANDBOX")throw Error("Invalid sandbox service");
await initialize();
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-herencia-preview":"sandbox"};
const server=http.createServer(async(req,res)=>{
 if(req.url==="/health"){res.writeHead(200,headers);res.end(JSON.stringify({ok:true,sandbox:true}));return;}
 try{
  const namespace=namespaceFromHost(req.headers["x-preview-host"]);
  const data=await handleSandboxApi(req,namespace);
  res.writeHead(200,headers);res.end(JSON.stringify(data));
 }catch(error){
  res.writeHead(Number(error.status)||500,headers);
  res.end(JSON.stringify({error:error.status?error.message:"Sandbox error",sandbox:true}));
 }
});
server.listen(Number(process.env.PORT||8080),"0.0.0.0");
