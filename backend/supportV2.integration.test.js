import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { registerSupportV2 } from "./supportV2.js";

function makeTestApp() {
  const app = express();
  app.use(express.json({limit:"6mb"}));
  const data = new Map();
  const parseCookies = req => Object.fromEntries(String(req.headers.cookie||"").split(";").filter(Boolean).map(x=>{
    const [name,...value]=x.trim().split("=");return [name,decodeURIComponent(value.join("="))];
  }));
  registerSupportV2(app,{
    getCustomerSession:req=>{
      const user=parseCookies(req).customer_auth;
      return user ? {customerId:user} : null;
    },
    loadCustomerAccounts:async()=>[
      {id:"user-a",name:"Ana",email:"ana@example.com"},
      {id:"user-b",name:"Beto",email:"beto@example.com"},
    ],
    isAdmin:req=>parseCookies(req).admin_auth==="yes",
    readStorageValue:async key=>data.get(key)||null,
    upsertStorageValue:async(key,value)=>{data.set(key,value);},
    deleteStorageValue:async(key)=>{data.delete(key);},
    hasNeon:()=>false,
    listNeonStorageByPrefix:async()=>[],
    mutateNeonStorageValue:async()=>{throw Error("Not used in mock");},
    requirePrimaryDatabase:()=>true,
    sign:input=>crypto.createHmac("sha256","test-secret").update(input).digest("hex"),
    parseCookies,
    cookieOptions:maxAge=>"HttpOnly; Path=/; Max-Age="+maxAge+"; SameSite=Lax",
    supportLimiter:(_req,_res,next)=>next(),
  });
  const server=app.listen(0);
  return {port:()=>server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
test("guest tickets, ownership, internal notes, admin replies and private images",async()=>{
  const app=makeTestApp();
  const base="http://127.0.0.1:"+app.port();
  const call=async(path,{method="GET",cookie="",body}={})=>{
    const res=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
    const contentType=res.headers.get("content-type")||"";
    const payload=contentType.includes("json")?await res.json():await res.arrayBuffer();
    return {res,payload};
  };
  try{
    const session=await call("/api/support/v2/session");
    assert.equal(session.res.status,200);
    assert.equal(session.payload.actor.type,"guest");
    const cookie=session.res.headers.get("set-cookie").split(";")[0];
    const start=await call("/api/support/v2/tickets",{cookie,method:"POST",body:{subject:"Primera",text:"Mi planta ha llegado mal"}});
    assert.equal(start.res.status,201);
    assert.match(start.payload.thread.id,/^t_/);
    const ticket=start.payload.thread;
    const second=await call("/api/support/v2/tickets",{cookie,method:"POST",body:{subject:"Otra consulta",text:"Me interesa un servicio"}});
    assert.equal(second.res.status,201);
    const list=await call("/api/support/v2/tickets",{cookie});
    assert.equal(list.payload.threads.length,2);
    const other=await call("/api/support/v2/session");
    const otherCookie=other.res.headers.get("set-cookie").split(";")[0];
    assert.notEqual(cookie,otherCookie);
    const readOther=await call("/api/support/v2/tickets/"+ticket.id,{cookie:otherCookie});
    assert.equal(readOther.res.status,404);
    const adminCookie="admin_auth=yes";
    const adminList=await call("/api/admin/support/v2/tickets",{cookie:adminCookie});
    assert.equal(adminList.payload.threads.length,2);
    const note=await call("/api/admin/support/v2/tickets/"+ticket.id+"/messages",{
      cookie:adminCookie,method:"POST",body:{text:"Solo el equipo puede ver esto",internal:true},
    });
    assert.equal(note.res.status,200);
    assert.equal(note.payload.thread.messages.at(-1).role,"internal");
    const customerRead=await call("/api/support/v2/tickets/"+ticket.id,{cookie});
    assert.equal(customerRead.payload.thread.messages.length,1);
    const reply=await call("/api/admin/support/v2/tickets/"+ticket.id+"/messages",{
      cookie:adminCookie,method:"POST",body:{text:"Vamos a ayudarte"},
    });
    assert.equal(reply.payload.thread.status,"answered");
    const afterReply=await call("/api/support/v2/tickets/"+ticket.id,{cookie});
    assert.equal(afterReply.payload.thread.messages.length,2);
    const picture="data:image/jpeg;base64,"+Buffer.from("ffd8ff00aabbaa","hex").toString("base64");
    const attachment=await call("/api/support/v2/tickets/"+ticket.id+"/attachments",{
      cookie,method:"POST",body:{filename:"planta.jpg",dataUrl:picture},
    });
    assert.equal(attachment.res.status,200);
    const fileId=attachment.payload.thread.messages.at(-1).attachmentId;
    const getFile=await call("/api/support/v2/tickets/"+ticket.id+"/attachments/"+fileId,{cookie});
    assert.equal(getFile.res.status,200);
    assert.equal(getFile.res.headers.get("content-type"),"image/jpeg");
    const denial=await call("/api/support/v2/tickets/"+ticket.id+"/attachments/"+fileId,{cookie:otherCookie});
    assert.equal(denial.res.status,404);
    const adminFile=await call("/api/support/v2/tickets/"+ticket.id+"/attachments/"+fileId,{cookie:adminCookie});
    assert.equal(adminFile.res.status,200);
    const anonAdmin=await call("/api/admin/support/v2/tickets",{cookie});
    assert.equal(anonAdmin.res.status,401);
    const wrongUser=await call("/api/support/v2/tickets/"+ticket.id,{cookie:"customer_auth=user-b"});
    assert.equal(wrongUser.res.status,404);
  }finally{await app.close();}
});
