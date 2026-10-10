import pg from "pg";
const url=String(process.env.PREVIEW_SANDBOX_DATABASE_URL||"");
if(!url.includes(".railway.internal"))throw Error("Sandbox needs dedicated private PostgreSQL");
export const db=new pg.Pool({connectionString:url,ssl:false,max:3,connectionTimeoutMillis:7000});
db.on("error",e=>console.warn("[SANDBOX_DB]",e.message));
export function namespaceFromHost(value){
 const host=String(value||"").toLowerCase().split(":")[0].trim();
 const match=host.match(/^neural-preview-([a-f0-9]{32})-production\.up\.railway\.app$/);
 if(!match)throw Object.assign(Error("Unknown preview host"),{status:403});
 return match[1];
}
export async function initialize(){
 await db.query("CREATE TABLE IF NOT EXISTS preview_data(namespace varchar(32) NOT NULL,key varchar(120) NOT NULL,value text NOT NULL,PRIMARY KEY(namespace,key))");
}
export async function read(ns,key){
 const out=await db.query("SELECT value FROM preview_data WHERE namespace=$1 AND key=$2",[ns,key]);
 return out.rows[0]?.value??null;
}
export async function write(ns,key,value){
 if(!/^[a-zA-Z0-9_:-]{1,120}$/.test(key))throw Object.assign(Error("Invalid demo key"),{status:400});
 if(typeof value!=="string"||Buffer.byteLength(value)>500000)throw Object.assign(Error("Demo value too large"),{status:413});
 await db.query("INSERT INTO preview_data(namespace,key,value) VALUES($1,$2,$3) ON CONFLICT(namespace,key) DO UPDATE SET value=EXCLUDED.value",[ns,key,value]);
}
export async function remove(ns,key){await db.query("DELETE FROM preview_data WHERE namespace=$1 AND key=$2",[ns,key]);}
export async function all(ns){
 const out=await db.query("SELECT key,value FROM preview_data WHERE namespace=$1",[ns]);
 return Object.fromEntries(out.rows.map(row=>[row.key,row.value]));
}
export async function list(ns,key,defaultValue){
 const value=await read(ns,key);
 if(value===null)return defaultValue;
 try{const p=JSON.parse(value);return Array.isArray(p)?p:defaultValue}catch{return defaultValue}
}
