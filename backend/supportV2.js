import crypto from "node:crypto";
import { parseSupportTicketMetadata } from "./supportTicketMetadata.js";
import { answerGeneralSupport } from "./customerSupportAI.js";

const TICKET_PREFIX = "customerSupportTicket:";
const ATTACHMENT_PREFIX = "customerSupportAttachment:";
const VALID_ID = /^(?:[a-f0-9-]{36}|[a-zA-Z0-9_-]{1,100})$/;
const MAX_FILE = 1_500_000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

export function validateSupportAttachment(dataUrl) {
  const match = /^data:(image\/png|image\/jpeg|image\/webp|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!match || !ALLOWED_MIME.has(match[1])) throw new Error("Solo se admiten imágenes JPG, PNG, WebP o documentos PDF");
  if (match[2].length > Math.ceil(MAX_FILE * 4 / 3) + 8) throw new Error("Archivo demasiado grande (máximo 1,5 MB)");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_FILE) throw new Error("Archivo vacío o demasiado grande (máximo 1,5 MB)");
  const mime = match[1];
  const signature = buffer.subarray(0, 12);
  const valid = mime === "image/png" && signature.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    || mime === "image/jpeg" && signature.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
    || mime === "image/webp" && signature.subarray(0, 4).toString() === "RIFF" && signature.subarray(8, 12).toString() === "WEBP"
    || mime === "application/pdf" && signature.subarray(0, 5).toString() === "%PDF-";
  if (!valid) throw new Error("El archivo no coincide con su formato declarado");
  return { mime, base64: buffer.toString("base64"), size: buffer.length };
}

async function sendSupportEmail(to, subject, body, ticketId, messageId) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const sender = String(process.env.EMAIL_FROM || "").trim();
  if (!apiKey || !sender || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to || ""))) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(7500),
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.createHash("sha256").update("herencia-support:"+ticketId+":"+messageId+":"+to).digest("hex"),
      },
      body: JSON.stringify({ from: sender, to: [to], subject, text: body }),
    });
    if (!response.ok) throw new Error("Email API status " + response.status);
    return true;
  } catch (error) {
    console.warn("[support notifications] Transactional email failed:", error.message);
    return false;
  }
}
function parseJSON(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
function safeId(value) {
  const id = String(value || "");
  return VALID_ID.test(id) ? id : null;
}
function safeText(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}
export function registerSupportV2(app, db) {
  const {
    getCustomerSession, loadCustomerAccounts, isAdmin, readStorageValue,
    upsertStorageValue, deleteStorageValue, hasNeon, listNeonStorageByPrefix,
    mutateNeonStorageValue, requirePrimaryDatabase, sign, parseCookies, cookieOptions,
    supportLimiter,
  } = db;

  // Server-Sent Events: no private transcript is transmitted in the event itself.
  const subscribers = new Set();
  function publishChange(ticket) {
    for (const entry of subscribers) {
      if (!entry.admin && (entry.ownerType !== ticket.ownerType || entry.ownerId !== ticket.ownerId)) continue;
      try { entry.response.write("event: update\ndata: {}\n\n"); }
      catch { subscribers.delete(entry); }
    }
  }
  function stream(req, res, admin) {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write("event: ready\ndata: {}\n\n");
    return { admin, response: res, timer: null };
  }
  function guestCookie(req) {
    try {
      const token = parseCookies(req).support_guest;
      const parts = String(token || "").split(".");
      if (parts.length !== 2) return null;
      const expected = Buffer.from(sign(parts[0]), "hex");
      const actual = Buffer.from(parts[1], "hex");
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
      const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      if (!/^[a-f0-9-]{36}$/.test(data.id) || data.role !== "guest" ||
          Date.now() - data.iat > 30 * 86400_000 || data.iat > Date.now()) return null;
      return data.id;
    } catch { return null; }
  }
  async function identity(req, res, createGuest = false) {
    const session = getCustomerSession(req);
    if (session) {
      const account = (await loadCustomerAccounts()).find(x => x.id === session.customerId);
      if (account) return { ownerType: "customer", ownerId: String(account.id), name: String(account.name || "Cliente"), email: String(account.email || "") };
    }
    let id = guestCookie(req);
    if (!id && createGuest) {
      id = crypto.randomUUID();
      const payload = Buffer.from(JSON.stringify({ role: "guest", id, iat: Date.now() })).toString("base64url");
      const token = payload + "." + sign(payload);
      res.setHeader("Set-Cookie", "support_guest=" + encodeURIComponent(token) + "; " + cookieOptions(30 * 86400));
    }
    return id ? { ownerType: "guest", ownerId: id, name: "Visitante", email: "" } : null;
  }
  function sameOwner(ticket, actor) {
    return Boolean(ticket && actor && (ticket.ownerType || "customer") === actor.ownerType &&
      String(ticket.ownerId || ticket.customerId) === actor.ownerId);
  }
  async function listTickets() {
    const tickets = hasNeon()
      ? (await listNeonStorageByPrefix(TICKET_PREFIX)).map(row => parseJSON(row.value))
      : (await Promise.all((parseJSON(await readStorageValue("customerSupportTicketIndex"), [])).map(id =>
        readStorageValue(TICKET_PREFIX + id).then(x => parseJSON(x)))));
    let legacy;
    if (hasNeon()) {
      legacy = (await listNeonStorageByPrefix("customerSupport:")).map(row => parseJSON(row.value));
    } else {
      const ids = parseJSON(await readStorageValue("customerSupportIndex"), []);
      legacy = await Promise.all(ids.map(id => readStorageValue("customerSupport:" + id).then(x => parseJSON(x))));
    }
    const old = legacy.filter(t => t?.customerId && Array.isArray(t.messages)).map(t => ({
      ...t, id: String(t.customerId), ownerType: "customer", ownerId: String(t.customerId), category: t.category || "general",
    }));
    return [...tickets.filter(t => t?.id && Array.isArray(t.messages)), ...old]
      .sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  function ticketKey(id) {
    return id.startsWith("t_") ? TICKET_PREFIX + id : "customerSupport:" + id;
  }
  async function loadTicket(id) {
    return parseJSON(await readStorageValue(ticketKey(id)));
  }
  async function mutateTicket(id, callback) {
    const key = ticketKey(id);
    if (hasNeon()) {
      const result = await mutateNeonStorageValue(key, value => {
        const next = callback(parseJSON(value));
        if (!next) throw Object.assign(new Error("Consulta no encontrada"), { status: 404 });
        return JSON.stringify(next);
      });
      const updated = parseJSON(result.value);
      if (updated) publishChange(updated);
      return updated;
    }
    const next = callback(await loadTicket(id));
    if (!next) throw Object.assign(new Error("Consulta no encontrada"), { status: 404 });
    await upsertStorageValue(key, JSON.stringify(next));
    publishChange(next);
    return next;
  }
  function internalView(ticket, admin = false) {
    if (admin) return ticket;
    return { ...ticket, messages: ticket.messages.filter(m => m.role !== "internal") };
  }
  async function withAI(ticket, input, askAI) {
    if (!askAI || !input || input.length > 800) return ticket;
    const lastMessageId = ticket.messages.at(-1)?.id;
    try {
      const site = parseJSON(await readStorageValue("siteContent"), {});
      const hours = (site?.contactPage?.hours || []).map(x => x.label + ": " + x.value).join("; ");
      const productList = parseJSON(await readStorageValue("adminProducts"), []);
      const known = Array.isArray(productList) ? productList.filter(x => x && x.status !== "draft" && x.deletedAt == null)
        .slice(0, 20).map(x => x.name || x.title).filter(Boolean).join(", ") : "";
      const context = "Herencia Market, Barcelona. Horario publicado: " + hours.slice(0, 800) +
        ". Productos publicados (referencias, no confirmar existencias sin comprobar): " + known.slice(0, 700) +
        ". Para pedidos, devoluciones, pagos, incidencias o consultas sobre identidad deriva a una persona.";
      const answer = await answerGeneralSupport(input, context);
      return mutateTicket(ticket.id, current => {
        const last = current?.messages?.at(-1);
        if (!last || last.id !== lastMessageId || last.role !== "customer" || current.status !== "open") return current;
        current.messages.push({ id: crypto.randomUUID(), role: "assistant", text: answer.reply, createdAt: new Date().toISOString() });
        if (!answer.needsHuman) current.status = "automated";
        current.updatedAt = new Date().toISOString();
        return current;
      });
    } catch (error) {
      console.warn("Support v2 AI unavailable", error?.message || error);
      return ticket;
    }
  }
  function route(handler) {
    return async (req, res) => {
      if (!requirePrimaryDatabase(res)) return;
      res.setHeader("Cache-Control", "private, no-store");
      try { await handler(req, res); }
      catch (error) {
        console.error("[support v2]", error?.message || error);
        if (!res.headersSent) res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo completar la operación de soporte" });
      }
    };
  }

  app.get("/api/support/v2/events", route(async (req, res) => {
    const actor = await identity(req,res);
    if (!actor) return res.status(401).json({error:"Sesión de soporte no encontrada"});
    const entry = stream(req,res,false);
    entry.ownerType=actor.ownerType;
    entry.ownerId=actor.ownerId;
    subscribers.add(entry);
    entry.timer=setInterval(()=>{try{res.write(": ping\n\n");}catch{res.end();}},20000);
    const cleanup=()=>{clearInterval(entry.timer);subscribers.delete(entry);};
    req.on("close",cleanup);
    setTimeout(()=>{if(!res.writableEnded)res.end();cleanup();},58000).unref?.();
  }));
  app.get("/api/admin/support/v2/events", route(async (req,res) => {
    if(!isAdmin(req))return res.status(401).json({error:"Acceso de administrador requerido"});
    const entry=stream(req,res,true);
    subscribers.add(entry);
    entry.timer=setInterval(()=>{try{res.write(": ping\n\n");}catch{res.end();}},20000);
    const cleanup=()=>{clearInterval(entry.timer);subscribers.delete(entry);};
    req.on("close",cleanup);
    setTimeout(()=>{if(!res.writableEnded)res.end();cleanup();},58000).unref?.();
  }));
  app.get("/api/support/v2/session", route(async(req,res)=>{
    const actor = await identity(req,res,true);
    res.json({ actor: { type: actor.ownerType, name: actor.name, email: actor.email } });
  }));
  app.get("/api/support/v2/tickets", route(async(req,res)=>{
    const actor = await identity(req,res,true);
    const threads = (await listTickets()).filter(t => sameOwner(t,actor)).map(t => internalView(t));
    res.json({ threads });
  }));
  app.post("/api/support/v2/tickets", supportLimiter, route(async(req,res)=>{
    const actor = await identity(req,res,true);
    const subject = safeText(req.body?.subject, 100) || "Nueva consulta";
    const text = safeText(req.body?.text);
    if (String(req.body?.text||"").trim().length > 2000) return res.status(400).json({ error: "Máximo 2000 caracteres" });
    if (!text) return res.status(400).json({ error: "Escribe tu consulta" });
    const id = "t_" + crypto.randomUUID();
    const now = new Date().toISOString();
    const ticket = {
      id, ticketId: "HER-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
      ownerType: actor.ownerType, ownerId: actor.ownerId,
      customerId: actor.ownerType === "customer" ? actor.ownerId : null,
      customerName: actor.ownerType === "guest" ? safeText(req.body?.name,70) || "Visitante" : actor.name,
      customerEmail: actor.email,
      subject, status: "open", priority: "normal", category: "general",
      createdAt: now, updatedAt: now,
      messages: [{ id: crypto.randomUUID(), role:"customer", text, createdAt:now }],
    };
    await upsertStorageValue(TICKET_PREFIX+id,JSON.stringify(ticket));
    publishChange(ticket);
    if (!hasNeon()) {
      const index = parseJSON(await readStorageValue("customerSupportTicketIndex"), []);
      await upsertStorageValue("customerSupportTicketIndex", JSON.stringify([...index,id]));
    }
    const updated = await withAI(ticket, text, req.body?.allowAI === true);
    if (updated.status === "open" && process.env.STORE_EMAIL) {
      void sendSupportEmail(process.env.STORE_EMAIL, "Nueva consulta de Herencia · " + updated.ticketId,
        "Hay una nueva consulta pendiente en Herencia Market. Ábrela desde Administración > Servicio al cliente.\n\nhttps://www.herenciamarket.es/admin",
        updated.ticketId, updated.messages[0].id);
    }
    res.status(201).json({ thread: internalView(updated) });
  }));
  app.get("/api/support/v2/tickets/:id", route(async(req,res)=>{
    const id=safeId(req.params.id);if(!id)return res.status(400).json({error:"Consulta no válida"});
    const actor=await identity(req,res); const t=await loadTicket(id);
    if(!sameOwner(t,actor))return res.status(404).json({error:"Consulta no encontrada"});
    res.json({thread:internalView(t)});
  }));
  app.post("/api/support/v2/tickets/:id/messages", supportLimiter, route(async(req,res)=>{
    const id=safeId(req.params.id);if(!id)return res.status(400).json({error:"Consulta no válida"});
    const actor=await identity(req,res);
    const text=safeText(req.body?.text);
    if(!text || String(req.body?.text||"").trim().length>2000)return res.status(400).json({error:"Escribe un mensaje de hasta 2000 caracteres"});
    const updated=await mutateTicket(id,t=>{
      if(!sameOwner(t,actor))return null;
      t.messages.push({id:crypto.randomUUID(),role:"customer",text,createdAt:new Date().toISOString()});
      t.status="open";t.updatedAt=new Date().toISOString();
      return t;
    });
    const reply=await withAI(updated,text,req.body?.allowAI === true);
    if(reply.status==="open" && process.env.STORE_EMAIL) {
      const lastHuman = [...reply.messages].reverse().find(m=>m.role==="customer");
      void sendSupportEmail(process.env.STORE_EMAIL, "Consulta pendiente · " + reply.ticketId,
        "Un cliente ha escrito en atención al cliente. Revisa la bandeja de Administración.\n\nhttps://www.herenciamarket.es/admin",
        reply.ticketId,lastHuman?.id||crypto.randomUUID());
    }
    res.json({thread:internalView(reply)});
  }));
  // Any authenticated guest/customer can remove a new ticket and its private media.
  app.delete("/api/support/v2/tickets/:id",supportLimiter,route(async(req,res)=>{
    const id=safeId(req.params.id);
    if(!id||!id.startsWith("t_"))return res.status(400).json({error:"Consulta no válida"});
    const actor=await identity(req,res);
    const ticket=await loadTicket(id);
    if(!sameOwner(ticket,actor))return res.status(404).json({error:"Consulta no encontrada"});
    for(const msg of ticket.messages||[])if(msg.attachmentId)await deleteStorageValue(ATTACHMENT_PREFIX+msg.attachmentId);
    await deleteStorageValue(ticketKey(id));
    if(!hasNeon()){
      const index=parseJSON(await readStorageValue("customerSupportTicketIndex"),[]);
      await upsertStorageValue("customerSupportTicketIndex",JSON.stringify(index.filter(x=>x!==id)));
    }
    publishChange(ticket);
    res.json({ok:true});
  }));
  app.get("/api/admin/support/v2/tickets", route(async(req,res)=>{
    if(!isAdmin(req))return res.status(401).json({error:"Acceso de administrador requerido"});
    res.json({threads:await listTickets()});
  }));
  app.post("/api/admin/support/v2/tickets/:id/messages",supportLimiter,route(async(req,res)=>{
    if(!isAdmin(req))return res.status(401).json({error:"Acceso de administrador requerido"});
    const id=safeId(req.params.id), text=safeText(req.body?.text);
    if(!id||!text||String(req.body?.text||"").trim().length>2000)return res.status(400).json({error:"Mensaje no válido"});
    const note=req.body?.internal===true;
    const thread=await mutateTicket(id,t=>{
      t.messages.push({id:crypto.randomUUID(),role:note?"internal":"agent",text,createdAt:new Date().toISOString()});
      if(!note)t.status="answered";
      t.updatedAt=new Date().toISOString();return t;
    });
    if(!note && thread.ownerType==="customer" && thread.customerEmail) {
      void sendSupportEmail(thread.customerEmail, "Herencia ha respondido · " + thread.ticketId,
        "El equipo de Herencia Market ha respondido a tu consulta.\n\nPara consultar la respuesta, entra a tu cuenta:\nhttps://www.herenciamarket.es/perfil",
        thread.ticketId,thread.messages.at(-1)?.id||crypto.randomUUID());
    }
    res.json({thread});
  }));
  app.patch("/api/admin/support/v2/tickets/:id",route(async(req,res)=>{
    if(!isAdmin(req))return res.status(401).json({error:"Acceso de administrador requerido"});
    const id=safeId(req.params.id);if(!id)return res.status(400).json({error:"Identificador no válido"});
    const changes={};
    if(req.body?.status!==undefined){
      if(!["open","resolved"].includes(req.body.status))return res.status(400).json({error:"Estado no válido"});
      changes.status=req.body.status;
    }
    if(req.body?.priority!==undefined||req.body?.category!==undefined)Object.assign(changes,parseSupportTicketMetadata(req.body));
    if(!Object.keys(changes).length)return res.status(400).json({error:"Sin cambios"});
    const thread=await mutateTicket(id,t=>({...t,...changes,updatedAt:new Date().toISOString()}));
    res.json({thread});
  }));
  app.post("/api/support/v2/tickets/:id/attachments",supportLimiter,route(async(req,res)=>{
    const id=safeId(req.params.id);if(!id)return res.status(400).json({error:"Consulta no válida"});
    const actor=await identity(req,res);
    const ticket=await loadTicket(id);
    if(!sameOwner(ticket,actor))return res.status(404).json({error:"Consulta no encontrada"});
    const {mime,base64,size}=validateSupportAttachment(req.body?.dataUrl);
    const attachmentId=crypto.randomUUID();
    const filename=safeText(req.body?.filename,85).replace(/[^\p{L}\p{N}._ -]/gu,"_")||"adjunto";
    const asset={id:attachmentId,mime,base64,size,filename,ownerId:actor.ownerId,ticketId:id};
    await upsertStorageValue(ATTACHMENT_PREFIX+attachmentId,JSON.stringify(asset));
    const thread=await mutateTicket(id,t=>{
      if(!sameOwner(t,actor))return null;
      t.messages.push({id:crypto.randomUUID(),role:"customer",text:"Archivo adjunto: "+filename,attachmentId,filename,mime,size,createdAt:new Date().toISOString()});
      t.status="open";t.updatedAt=new Date().toISOString();
      return t;
    });
    res.json({thread:internalView(thread)});
  }));
  app.get("/api/support/v2/tickets/:id/attachments/:attachmentId",route(async(req,res)=>{
    const id=safeId(req.params.id), attachmentId=safeId(req.params.attachmentId);
    if(!id||!attachmentId)return res.status(400).json({error:"Archivo no válido"});
    const actor=await identity(req,res), t=await loadTicket(id);
    if(!isAdmin(req)&&!sameOwner(t,actor))return res.status(404).json({error:"Archivo no encontrado"});
    if(!t?.messages?.some(m=>m.attachmentId===attachmentId))return res.status(404).json({error:"Archivo no encontrado"});
    const asset=parseJSON(await readStorageValue(ATTACHMENT_PREFIX+attachmentId));
    if(!asset||asset.ticketId!==id)return res.status(404).json({error:"Archivo no encontrado"});
    const buffer=Buffer.from(asset.base64,"base64");
    res.setHeader("Content-Type",asset.mime);
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Content-Security-Policy","default-src 'none'; sandbox");
    res.setHeader("Content-Disposition",(asset.mime==="application/pdf"?"attachment":"inline")+'; filename="adjunto"');
    res.send(buffer);
  }));
  return {
    async exportCustomerTickets(customerId) {
      return (await listTickets())
        .filter(t => t.ownerType === "customer" && t.ownerId === String(customerId))
        .map(t => internalView(t));
    },
    async removeCustomerTickets(customerId) {
      const mine=(await listTickets()).filter(t=>t.ownerType==="customer"&&t.ownerId===customerId);
      for(const thread of mine) {
        for(const message of thread.messages||[])if(message.attachmentId)await deleteStorageValue(ATTACHMENT_PREFIX+message.attachmentId);
        if(thread.id!==customerId)await deleteStorageValue(TICKET_PREFIX+thread.id);
      }
      if(!hasNeon()) {
        const index=parseJSON(await readStorageValue("customerSupportTicketIndex"),[]);
        await upsertStorageValue("customerSupportTicketIndex",
          JSON.stringify(index.filter(id=>!mine.some(ticket=>ticket.id===id))));
      }
    },
  };
}
