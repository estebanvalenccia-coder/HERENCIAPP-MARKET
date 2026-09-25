import express from "express";

const requestBuckets = new Map();

function cleanJson(value = "{}") {
  return String(value)
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(cleanJson(value));
  } catch {
    return fallback;
  }
}

function clampText(value, max = 1800) {
  return String(value || "").trim().slice(0, max);
}

function commercialRateLimit(req, res) {
  const key = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 30;
  const current = requestBuckets.get(key);

  if (!current || now - current.startedAt > windowMs) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }

  current.count += 1;
  if (current.count > limit) {
    res.status(429).json({ error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." });
    return false;
  }

  return true;
}

function normalizeCatalog(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 80).map((item) => ({
    id: Number(item?.id),
    name: clampText(item?.name, 120),
    category: clampText(item?.category, 80),
    price: Number(item?.price || 0),
    description: clampText(item?.description, 220),
  })).filter((item) => Number.isFinite(item.id) && item.name);
}

function sizeFromBudget(budget) {
  const value = Number(budget || 0);
  if (value >= 90) return "XL";
  if (value >= 70) return "L";
  if (value >= 50) return "M";
  return "S";
}

function bouquetPrice(size) {
  return ({ S: 39.9, M: 54.9, L: 74.9, XL: 99.9 })[String(size || "M").toUpperCase()] || 54.9;
}

async function callGroq(messages, { temperature = 0.35 } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY no está configurada en Railway");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(Number(process.env.SALES_AI_TIMEOUT_MS || 30000)),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature,
      stream: false,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Groq respondió ${response.status}: ${text}`);
  const json = safeJson(text, {});
  return json?.choices?.[0]?.message?.content || "{}";
}

async function generateGeminiImage(prompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada en Railway");

  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(Number(process.env.SALES_AI_TIMEOUT_MS || 30000) + 15000),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${prompt}\n\nGenera una sola fotografía de producto hiperrealista. El ramo debe verse completo y físicamente realizable por una floristería. Fondo limpio, iluminación natural premium, sin texto, sin logos, sin personas, sin manos.`,
          }],
        }],
      }),
    }
  );

  const text = await response.text();
  if (!response.ok) throw new Error(`Gemini Image respondió ${response.status}: ${text}`);
  const json = safeJson(text, {});
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  if (!inlineData?.data) throw new Error("Gemini no devolvió una imagen");

  return `data:${inlineData.mimeType || inlineData.mime_type || "image/png"};base64,${inlineData.data}`;
}

async function identifyWithGemini({ data, mimeType, catalog }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada en Railway");

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const catalogText = JSON.stringify(catalog);
  const prompt = `Eres el buscador visual COMERCIAL de Herencia Market.
Tu única función es identificar qué planta o producto quiere COMPRAR el cliente y relacionarlo con el catálogo.
NO des cuidados, diagnósticos, consejos de jardinería ni asesoría gratuita.
Si preguntan por cuidados, responde brevemente que aquí puedes ayudarle a encontrar productos para comprar.
Catálogo disponible: ${catalogText}
Devuelve SOLO JSON:
{
  "reply": "respuesta comercial breve",
  "identifiedName": "nombre probable",
  "confidence": "alta|media|baja",
  "productIds": [1,2]
}
Usa únicamente IDs que existan en el catálogo. Si no hay coincidencia, productIds debe ser [].`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(Number(process.env.SALES_AI_TIMEOUT_MS || 30000)),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType || "image/jpeg", data } },
          ],
        }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  const text = await response.text();
  if (!response.ok) throw new Error(`Gemini Vision respondió ${response.status}: ${text}`);
  const json = safeJson(text, {});
  const content = json?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") || "{}";
  return safeJson(content, {});
}

function salesSystemPrompt(catalog) {
  return `Eres HERENCIA SALES, vendedor digital especializado de Herencia Market.

MISIÓN ÚNICA:
Ayudar al cliente a descubrir, personalizar, visualizar y COMPRAR productos de Herencia.

PROHIBIDO:
- dar asesorías gratuitas extensas;
- explicar cuidados de plantas;
- diagnosticar enfermedades;
- enseñar jardinería;
- resolver consultas generales;
- inventar stock, precios o productos.

Si alguien pide asesoría o cuidados, responde en una sola frase que este chat está dedicado a encontrar o crear productos para comprar y vuelve a una pregunta comercial.

CATÁLOGO REAL DISPONIBLE:
${JSON.stringify(catalog)}

Solo puedes recomendar IDs del catálogo anterior.

Para ramos personalizados, recoge progresivamente presupuesto, ocasión, estilo y colores. No hagas interrogatorios. Cuando haya información suficiente marca readyToGenerate=true.

Devuelve SIEMPRE JSON válido con:
{
  "reply": "respuesta breve, cálida y orientada a la compra",
  "intent": "product_search|plant_search|bouquet|gift|purchase|other",
  "productIds": [],
  "bouquet": null
}

Si intent=bouquet, bouquet puede ser:
{
  "description": "resumen de lo que quiere el cliente",
  "budget": 50,
  "style": "Elegante",
  "color": "Blanco y azul",
  "size": "S|M|L|XL",
  "readyToGenerate": true
}

No inventes precios. Los precios los calcula Herencia Market. No digas que algo está disponible si el catálogo no lo contiene.`;
}

async function salesChatHandler(req, res) {
  if (!commercialRateLimit(req, res)) return;

  const body = req.body || {};
  const message = clampText(body.message, 1600);
  const catalog = normalizeCatalog(body.catalog);
  const history = Array.isArray(body.history)
    ? body.history.slice(-10).map((item) => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: clampText(item?.content, 1200),
      }))
    : [];

  if (!message) return res.status(400).json({ error: "Escribe qué quieres encontrar o crear." });

  try {
    const content = await callGroq([
      { role: "system", content: salesSystemPrompt(catalog) },
      ...history,
      { role: "user", content: message },
    ]);

    const result = safeJson(content, {});
    const validIds = new Set(catalog.map((item) => item.id));
    result.productIds = Array.isArray(result.productIds)
      ? result.productIds.map(Number).filter((id) => validIds.has(id)).slice(0, 4)
      : [];

    if (result.bouquet) {
      result.bouquet.budget = Number(result.bouquet.budget || 0);
      result.bouquet.size = ["S","M","L","XL"].includes(String(result.bouquet.size || "").toUpperCase())
        ? String(result.bouquet.size).toUpperCase()
        : sizeFromBudget(result.bouquet.budget);
    }

    res.json({
      reply: clampText(result.reply, 1200) || "Puedo ayudarte a encontrar o crear algo para comprar en Herencia.",
      intent: result.intent || "other",
      productIds: result.productIds,
      bouquet: result.bouquet || null,
    });
  } catch (error) {
    console.error("[HERENCIA SALES] chat:", error);
    res.status(502).json({ error: error?.message || "No se pudo responder ahora mismo." });
  }
}

async function salesBouquetHandler(req, res) {
  if (!commercialRateLimit(req, res)) return;

  const body = req.body || {};
  const budget = Number(body.budget || 0);
  const size = ["S","M","L","XL"].includes(String(body.size || "").toUpperCase())
    ? String(body.size).toUpperCase()
    : sizeFromBudget(budget);
  const price = bouquetPrice(size);

  const prompt = `Crea una propuesta de ramo COMERCIAL y físicamente realizable para una floristería.
Idea del cliente: ${clampText(body.description, 700)}
Estilo: ${clampText(body.style, 80) || "Elegante"}
Color: ${clampText(body.color, 100) || "Mix"}
Tamaño comercial: ${size}
Precio oficial del tamaño: ${price.toFixed(2)} EUR.
Devuelve solo JSON:
{
 "name":"nombre comercial corto",
 "description":"descripción vendedora de máximo 2 frases",
 "recommendedFlowers":["flor"],
 "imagePrompt":"descripción visual precisa del ramo para generar fotografía realista"
}
No incluyas consejos ni cuidados.`;

  try {
    let proposal = {};
    try {
      const content = await callGroq([
        { role: "system", content: "Eres diseñador floral comercial. Solo JSON válido." },
        { role: "user", content: prompt },
      ], { temperature: 0.55 });
      proposal = safeJson(content, {});
    } catch (groqError) {
      console.warn("[HERENCIA SALES] propuesta Groq fallback:", groqError?.message || groqError);
      proposal = {
        name: "Ramo personalizado Herencia",
        description: "Diseño floral personalizado creado según tus preferencias.",
        recommendedFlowers: [],
        imagePrompt: `Ramo premium ${clampText(body.style, 80)} en tonos ${clampText(body.color, 100)}, tamaño ${size}. ${clampText(body.description, 500)}`,
      };
    }

    const imagePrompt = clampText(proposal.imagePrompt, 1800) ||
      `Ramo premium ${clampText(body.style, 80)} en tonos ${clampText(body.color, 100)}, tamaño ${size}`;
    const image = await generateGeminiImage(imagePrompt);

    res.json({
      proposal: {
        name: clampText(proposal.name, 120) || "Ramo personalizado Herencia",
        description: clampText(proposal.description, 500),
        recommendedFlowers: Array.isArray(proposal.recommendedFlowers) ? proposal.recommendedFlowers.slice(0, 8) : [],
        imagePrompt,
      },
      image,
      price,
      size,
      currency: "EUR",
      disclaimer: "La imagen es una referencia visual. Las flores naturales pueden variar y se podrán sustituir por equivalentes según disponibilidad.",
    });
  } catch (error) {
    console.error("[HERENCIA SALES] bouquet:", error);
    res.status(502).json({ error: error?.message || "No se pudo generar el diseño." });
  }
}

async function salesIdentifyHandler(req, res) {
  if (!commercialRateLimit(req, res)) return;

  const body = req.body || {};
  const data = String(body.data || "");
  const mimeType = String(body.mimeType || "image/jpeg");
  const catalog = normalizeCatalog(body.catalog);

  if (!data || data.length > 9_000_000) {
    return res.status(400).json({ error: "La imagen es demasiado grande o está vacía." });
  }

  try {
    const result = await identifyWithGemini({ data, mimeType, catalog });
    const validIds = new Set(catalog.map((item) => item.id));
    const productIds = Array.isArray(result.productIds)
      ? result.productIds.map(Number).filter((id) => validIds.has(id)).slice(0, 4)
      : [];

    res.json({
      reply: clampText(result.reply, 800) || "He analizado la imagen y puedo ayudarte a encontrar un producto parecido.",
      identifiedName: clampText(result.identifiedName, 140),
      confidence: ["alta","media","baja"].includes(result.confidence) ? result.confidence : "media",
      productIds,
    });
  } catch (error) {
    console.error("[HERENCIA SALES] identify:", error);
    res.status(502).json({ error: error?.message || "No se pudo analizar la imagen." });
  }
}

const originalPost = express.application.post;

express.application.post = function patchedSalesPost(path, ...handlers) {
  if (path === "/api/ai/sales-chat") {
    return originalPost.call(this, path, express.json({ limit: "1mb" }), salesChatHandler);
  }

  if (path === "/api/ai/sales-bouquet") {
    return originalPost.call(this, path, express.json({ limit: "1mb" }), salesBouquetHandler);
  }

  if (path === "/api/ai/sales-identify") {
    return originalPost.call(this, path, express.json({ limit: "10mb" }), salesIdentifyHandler);
  }

  return originalPost.call(this, path, ...handlers);
};

// Registrar rutas públicas aunque server.js no las declare explícitamente.
// Este preload se ejecuta antes de crear la app.
const originalListen = express.application.listen;
express.application.listen = function patchedListen(...args) {
  const app = this;
  const stack = app?._router?.stack || [];
  const paths = new Set(stack.map((layer) => layer?.route?.path).filter(Boolean));

  if (!paths.has("/api/ai/sales-chat")) app.post("/api/ai/sales-chat", express.json({ limit: "1mb" }), salesChatHandler);
  if (!paths.has("/api/ai/sales-bouquet")) app.post("/api/ai/sales-bouquet", express.json({ limit: "1mb" }), salesBouquetHandler);
  if (!paths.has("/api/ai/sales-identify")) app.post("/api/ai/sales-identify", express.json({ limit: "10mb" }), salesIdentifyHandler);

  return originalListen.apply(this, args);
};

console.log("HERENCIA SALES AI preparada: chat comercial, búsqueda visual y diseñador de ramos.");
