import express from "express";

const buckets = new Map();

function rateLimit(req, res) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const key = ip;
  const current = buckets.get(key);
  if (!current || now - current.startedAt > 60000) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  const limit = Math.max(3, Number(process.env.HERENCIA_AI_LIMIT_PER_MINUTE || 30));
  if (current.count > limit) {
    res.status(429).json({ error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." });
    return false;
  }
  return true;
}

function clamp(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

async function callGroq(message, lang = "es", mode = "chat") {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY no está configurada en Railway");
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const system = `Eres Herenc(IA), asistente de Herencia Market. Responde de forma cálida, clara y útil en el idioma solicitado.
Puedes ayudar con plantas, flores, regalos, decoración y orientación general relacionada con Herencia.
No inventes disponibilidad, precios ni datos comerciales. Cuando una respuesta dependa del catálogo real, indica que debe consultarse la tienda.
Si el modo es diagnóstico, ofrece orientación prudente basada en síntomas visibles y recomienda acudir a un profesional cuando exista riesgo.
Idioma: ${lang}. Modo: ${mode}.`;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(Number(process.env.HERENCIA_AI_TIMEOUT_MS || 30000)),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: clamp(message, 3000) }
      ]
    })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Groq respondió ${response.status}: ${raw}`);
  const json = JSON.parse(raw);
  return clamp(json?.choices?.[0]?.message?.content || "", 6000);
}

async function chatHandler(req, res) {
  if (!rateLimit(req, res)) return;
  const message = clamp(req.body?.message, 3000);
  if (!message) return res.status(400).json({ error: "Escribe un mensaje." });
  try {
    const reply = await callGroq(message, clamp(req.body?.lang || "es", 12), "chat");
    res.json({ reply });
  } catch (error) {
    console.error("[HerencIA] chat:", error);
    res.status(502).json({ error: error?.message || "No se pudo responder." });
  }
}

async function diagnosisHandler(req, res) {
  if (!rateLimit(req, res)) return;
  const text = clamp(req.body?.message || req.body?.prompt || req.body?.symptoms || "Analiza el problema descrito.", 3000);
  try {
    const reply = await callGroq(text, clamp(req.body?.lang || "es", 12), "diagnóstico de plantas");
    res.json({ reply, diagnosis: reply });
  } catch (error) {
    console.error("[HerencIA] diagnosis:", error);
    res.status(502).json({ error: error?.message || "No se pudo analizar." });
  }
}

const originalPost = express.application.post;
express.application.post = function patchedHerenciaAiPost(path, ...handlers) {
  if (path === "/api/herencia-ai/chat") return originalPost.call(this, path, express.json({ limit: "2mb" }), chatHandler);
  if (path === "/api/herencia-ai/diagnosis") return originalPost.call(this, path, express.json({ limit: "4mb" }), diagnosisHandler);
  return originalPost.call(this, path, ...handlers);
};

const originalListen = express.application.listen;
express.application.listen = function patchedHerenciaAiListen(...args) {
  const app = this;
  const stack = app?._router?.stack || [];
  const paths = new Set(stack.map((layer) => layer?.route?.path).filter(Boolean));
  if (!paths.has("/api/herencia-ai/chat")) app.post("/api/herencia-ai/chat", express.json({ limit: "2mb" }), chatHandler);
  if (!paths.has("/api/herencia-ai/diagnosis")) app.post("/api/herencia-ai/diagnosis", express.json({ limit: "4mb" }), diagnosisHandler);
  return originalListen.apply(this, args);
};

console.log("Herenc(IA) integrada: rutas internas /api/herencia-ai/* listas.");
