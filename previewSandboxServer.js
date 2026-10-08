import http from "node:http";
import pg from "pg";
// Only run this API in its dedicated isolated Railway service.
if(process.env.RAILWAY_SERVICE_NAME!=="HERENCIA-PREVIEW-SANDBOX")throw Error("Invalid sandbox service");
const databaseUrl=process.env.PREVIEW_SANDBOX_DATABASE_URL||"";
if(!databaseUrl.includes(".railway.internal"))throw Error("Dedicated Postgres is required");
const db=new pg.Pool({connectionString:databaseUrl,ssl:false,max:3});
db.on("error",error=>console.error("Sandbox database:",error.message));
await db.query("CREATE TABLE IF NOT EXISTS preview_data(namespace text NOT NULL,key text NOT NULL,value text NOT NULL,PRIMARY KEY(namespace,key))");
const server=http.createServer(async(req,res)=>{
 res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
 res.end(JSON.stringify({ok:true,sandbox:true}));
});
server.listen(Number(process.env.PORT||8080),"0.0.0.0");
