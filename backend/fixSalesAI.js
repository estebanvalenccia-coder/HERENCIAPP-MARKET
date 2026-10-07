import express from "express";
import { hasR2, uploadR2Media } from "./r2Media.js";

const requestBuckets = new Map();
const generatedImageCache = new Map();

function rememberGeneratedImage(key, value) {
  if (!key || !value) return;
  generatedImageCache.set(key, value);
  while (generatedImageCache.size > 24) {
    const firstKey = generatedImageCache.keys().next().value;
    generatedImageCache.delete(firstKey);
  }
}

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
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const path = String(req.path || req.url || "sales");
  const imageRequest = /sales-(bouquet|identify|space-preview)/.test(path);
  const limit = Math.max(
    3,
    Number(imageRequest ? process.env.SALES_AI_IMAGE_LIMIT_PER_MINUTE || 12 : process.env.SALES_AI_CHAT_LIMIT_PER_MINUTE || 30)
  );
  const bucketKey = `${ip}:${imageRequest ? "image" : "chat"}`;
  const now = Date.now();
  const windowMs = 60_000;
  const current = requestBuckets.get(bucketKey);

  if (!current || now - current.startedAt > windowMs) {
    requestBuckets.set(bucketKey, { startedAt: now, count: 1 });
    return true;
  }

  current.count += 1;
  if (current.count > limit) {
    res.status(429).json({
      error: imageRequest
        ? "Has generado muchas imágenes seguidas. Inténtalo de nuevo en un minuto."
        : "Demasiadas solicitudes. Inténtalo de nuevo en un momento.",
    });
    return false;
  }

  return true;
}

function normalizeCatalog(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 120).map((item) => {
    const variants = Array.isArray(item?.variants)
      ? item.variants.slice(0, 20).map((variant) => ({
          id: clampText(variant?.id, 120),
          name: clampText(typeof variant === "string" ? variant : variant?.name, 120),
          price: variant?.price == null ? null : Math.max(0, Number(variant.price || 0)),
          stock: variant?.stock == null ? null : Math.max(0, Math.floor(Number(variant.stock || 0))),
        })).filter((variant) => variant.name)
      : [];
    const trackInventory = item?.trackInventory !== false;
    const stock = Math.max(0, Math.floor(Number(item?.stock || 0)));
    const variantAvailable = variants.some((variant) => variant.stock == null || Number(variant.stock) > 0);
    return {
      id: clampText(item?.id, 160),
      name: clampText(item?.name, 120),
      category: clampText(item?.category, 80),
      type: clampText(item?.type, 80),
      collections: Array.isArray(item?.collections) ? item.collections.slice(0, 12).map((value) => clampText(value, 80)).filter(Boolean) : [],
      price: Math.max(0, Number(item?.price || 0)),
      salePrice: item?.salePrice == null ? null : Math.max(0, Number(item.salePrice || 0)),
      onSale: Boolean(item?.onSale),
      stock,
      trackInventory,
      available: item?.active !== false && String(item?.status || "active") !== "archived" && (!trackInventory || stock > 0 || variantAvailable),
      description: clampText(item?.description, 320),
      image: clampText(item?.image || item?.imageUrl || "", 1200),
      variants,
    };
  }).filter((item) => item.id && item.name && item.available);
}

function normalizeFlowerCatalog(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 60).map((flower) => ({
    id: clampText(flower?.id, 120),
    name: clampText(flower?.name, 120),
    category: clampText(flower?.category, 100),
    price: Math.max(0, Number(flower?.price || 0)),
  })).filter((flower) => flower.id && flower.name);
}

async function persistGeneratedImage(dataUrl, filename = "herencia-sales") {
  if (!hasR2 || !String(dataUrl || "").startsWith("data:image/")) return dataUrl;

  try {
    const media = await uploadR2Media({ dataUrl, filename });
    return media.url;
  } catch (error) {
    console.warn("[HERENCIA SALES] no se pudo persistir imagen IA en R2:", error?.message || error);
    return dataUrl;
  }
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
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
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
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada en Railway");

  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
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

async function imageReferenceFromUrl(value) {
  const url = String(value || "").trim();
  if (!url) return null;

  if (url.startsWith("data:image/")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2] };
  }

  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("La imagen del producto debe usar HTTPS");
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("URL de imagen no permitida");
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
    headers: { Accept: "image/*" },
  });
  if (!response.ok) throw new Error(`No se pudo leer la imagen del producto (${response.status})`);
  const mimeType = String(response.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!mimeType.startsWith("image/")) throw new Error("La referencia del producto no es una imagen");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 8 * 1024 * 1024) throw new Error("La imagen del producto es demasiado grande");
  return { mimeType, data: buffer.toString("base64") };
}

async function generateGeminiSpacePreview({ roomData, roomMimeType, product }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada en Railway");

  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
  let productReference = null;
  try {
    productReference = await imageReferenceFromUrl(product?.image);
  } catch (error) {
    console.warn("[HERENCIA SALES] referencia visual producto:", error?.message || error);
  }

  const prompt = `Edita la PRIMERA imagen, que es la fotografía real del espacio del cliente.
Inserta de forma fotorealista el producto de Herencia Market llamado "${clampText(product?.name, 140)}".
Categoría: ${clampText(product?.category, 80)}.
Descripción del producto: ${clampText(product?.description, 300)}.

REGLAS OBLIGATORIAS:
- Conserva exactamente la habitación, terraza, jardín u oficina original: arquitectura, muebles, suelo, paredes, ventanas, iluminación y encuadre.
- Añade únicamente el producto solicitado en un lugar físicamente plausible, sin eliminar ni sustituir objetos existentes salvo una oclusión natural.
- Respeta perspectiva, escala, sombras, reflejos y dirección de la luz.
- Si se aporta una SEGUNDA imagen, úsala como referencia visual del producto y conserva su aspecto, maceta, forma y color tanto como sea posible.
- No añadas texto, logos, personas ni productos adicionales.
- El resultado debe parecer una fotografía real tomada después de colocar el producto en ese espacio.
- Genera UNA sola imagen final.`;

  const parts = [
    { text: prompt },
    { inlineData: { mimeType: roomMimeType || "image/jpeg", data: roomData } },
  ];
  if (productReference) parts.push({ inlineData: productReference });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(Number(process.env.SALES_AI_TIMEOUT_MS || 30000) + 30000),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );

  const text = await response.text();
  if (!response.ok) throw new Error(`Gemini Image respondió ${response.status}: ${text}`);
  const json = safeJson(text, {});
  const resultParts = json?.candidates?.[0]?.content?.parts || [];
  const imagePart = resultParts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  if (!inlineData?.data) throw new Error("Gemini no devolvió la visualización del espacio");

  return `data:${inlineData.mimeType || inlineData.mime_type || "image/png"};base64,${inlineData.data}`;
}

async function identifyWithGemini({ data, mimeType, catalog }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada en Railway");

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash";
  const catalogText = JSON.stringify(catalog);
  const prompt = `Eres Herenc(IA), asistente experto y polivalente de Herencia Market especializado en plantas, botánica práctica y jardinería.
Identifica la planta o producto y analiza, cuando sea relevante, signos visibles compatibles con problemas de riego, luz, humedad, sustrato, nutrientes, plagas u hongos.
Puedes explicar cuidados, prevención, recuperación, propagación, trasplante, poda y jardinería. Si la imagen no permite un diagnóstico fiable, dilo y pide el dato mínimo que falte. No presentes una sospecha visual como certeza.
También puedes relacionar la consulta con productos REALES del catálogo cuando sean útiles, sin forzar una venta.
Catálogo disponible: ${catalogText}
Devuelve SOLO JSON:
{
  "reply": "respuesta útil; puede incluir diagnóstico orientativo, cuidados y pasos recomendados",
  "identifiedName": "nombre probable",
  "confidence": "alta|media|baja",
  "productIds": ["id-real-1","id-real-2"]
}
Los IDs pueden ser texto. Usa únicamente IDs exactos que existan en el catálogo. Si no hay coincidencia, productIds debe ser [].`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
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
  return `Eres Herenc(IA), el asistente polivalente de Herencia Market especializado en plantas y también asistente de compra.

Tu misión principal es ayudar de verdad. NO estás limitado a vender.

Puedes responder sobre identificación de plantas; riego; luz; humedad; temperatura; sustratos y drenaje; abonado y nutrientes; trasplante; poda; propagación; recuperación; hojas amarillas, marrones, secas, caídas o con manchas; hongos y pudriciones; enfermedades; trips, cochinilla, araña roja, pulgón, mosca del sustrato y otras plagas; toxicidad para mascotas cuando tengas información fiable; cuidados estacionales; jardinería; elección de plantas según el espacio; y cualquier otra consulta razonable relacionada con plantas.

Responde primero a la pregunta del cliente. No conviertas automáticamente cada conversación en una venta. Da instrucciones prácticas y paso a paso cuando ayuden. En diagnósticos distingue síntomas, causas probables y confirmación; si faltan datos, pregunta lo mínimo necesario. No afirmes una enfermedad, plaga o carencia como certeza si no puede confirmarse.

Además puedes buscar, comparar, personalizar y vender productos de Herencia. Recomienda productos solo cuando sean realmente útiles. Si Herencia no vende algo apropiado, ayuda igualmente y no fuerces una venta.

CATÁLOGO REAL DISPONIBLE:
${JSON.stringify(catalog)}

REGLAS COMERCIALES:
- Solo recomienda IDs exactos del catálogo.
- No inventes stock, precios, productos, promociones ni disponibilidad.
- No recomiendes agotados.
- Respeta price, salePrice y variantes.
- No inventes propiedades médicas ni recomiendes remedios peligrosos.

Para ramos personalizados recoge progresivamente presupuesto, ocasión, estilo y colores. Cuando haya información suficiente marca readyToGenerate=true.

Devuelve SIEMPRE JSON válido:
{
  "reply": "respuesta útil, clara, cálida y natural",
  "intent": "plant_care|plant_diagnosis|pest|fungus|watering|light|substrate|nutrition|propagation|plant_search|product_search|bouquet|gift|purchase|gardening|other",
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

Los precios los calcula Herencia Market. No digas que algo está disponible si el catálogo no lo contiene.`;
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
    const validIds = new Set(catalog.map((item) => String(item.id)));
    result.productIds = Array.isArray(result.productIds)
      ? result.productIds.map((id) => String(id)).filter((id) => validIds.has(id)).slice(0, 4)
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
  const flowerCatalog = normalizeFlowerCatalog(body.flowerCatalog);
  const exactFlowers = Array.isArray(body.exactFlowers)
    ? body.exactFlowers
        .slice(0, 20)
        .map((flower) => ({
          id: clampText(flower?.id, 80),
          name: clampText(flower?.name, 120),
          quantity: Math.max(1, Math.min(50, Number(flower?.quantity || 1))),
        }))
        .filter((flower) => flower.name)
    : [];
  const exactComposition = exactFlowers
    .map((flower) => `${flower.quantity} x ${flower.name}`)
    .join(", ");
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
Catálogo floral ACTIVO permitido: ${JSON.stringify(flowerCatalog)}
Devuelve solo JSON:
{
 "name":"nombre comercial corto",
 "description":"descripción vendedora de máximo 2 frases",
 "recommendedFlowerIds":["id-flor"],
 "recommendedFlowers":["nombre flor"],
 "imagePrompt":"descripción visual precisa del ramo para generar fotografía realista"
}
Si existe catálogo floral, utiliza únicamente flores y verdes de ese catálogo. No incluyas consejos ni cuidados.`;

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

    const flowerById = new Map(flowerCatalog.map((flower) => [flower.id, flower]));
    const flowerByName = new Map(flowerCatalog.map((flower) => [flower.name.toLowerCase(), flower]));
    const recommendedFromIds = Array.isArray(proposal.recommendedFlowerIds)
      ? proposal.recommendedFlowerIds.map((id) => flowerById.get(String(id))).filter(Boolean)
      : [];
    const recommendedFromNames = Array.isArray(proposal.recommendedFlowers)
      ? proposal.recommendedFlowers.map((name) => flowerByName.get(String(name).toLowerCase())).filter(Boolean)
      : [];
    const validatedRecommended = flowerCatalog.length
      ? [...new Map([...recommendedFromIds, ...recommendedFromNames].map((flower) => [flower.id, flower])).values()].slice(0, 8)
      : [];

    const recommendedNames = exactFlowers.length
      ? exactFlowers.map((flower) => flower.name)
      : validatedRecommended.length
        ? validatedRecommended.map((flower) => flower.name)
        : Array.isArray(proposal.recommendedFlowers)
          ? proposal.recommendedFlowers.slice(0, 8).map((name) => clampText(name, 120))
          : [];

    const imagePrompt = exactFlowers.length
      ? `Fotografía de producto hiperrealista de un ramo físicamente realizable. Composición OBLIGATORIA: ${exactComposition}. No añadas ningún otro tipo de flor que no aparezca en esa lista. Respeta aproximadamente las cantidades relativas indicadas. Estilo ${clampText(body.style, 80) || "Elegante"}, tamaño ${size}. Mantén los colores naturales de cada variedad. Ramo completo, centrado, fondo limpio y claro, iluminación natural premium.`
      : recommendedNames.length
        ? `Fotografía de producto hiperrealista de un ramo físicamente realizable compuesto únicamente por estas variedades disponibles: ${recommendedNames.join(", ")}. Estilo ${clampText(body.style, 80) || "Elegante"}, tonos ${clampText(body.color, 100) || "naturales"}, tamaño ${size}. No añadas variedades fuera de la lista. Ramo completo, centrado, fondo limpio y claro, iluminación natural premium.`
        : clampText(proposal.imagePrompt, 1800) ||
          `Ramo premium ${clampText(body.style, 80)} en tonos ${clampText(body.color, 100)}, tamaño ${size}`;

    const cacheKey = `bouquet:${imagePrompt}`;
    let image = generatedImageCache.get(cacheKey);
    if (!image) {
      const rawImage = await generateGeminiImage(imagePrompt);
      image = await persistGeneratedImage(rawImage, `herencia-sales-ramo-${size.toLowerCase()}`);
      rememberGeneratedImage(cacheKey, image);
    }

    res.json({
      proposal: {
        name: clampText(proposal.name, 120) || "Ramo personalizado Herencia",
        description: clampText(proposal.description, 500),
        recommendedFlowers: recommendedNames,
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
    const validIds = new Set(catalog.map((item) => String(item.id)));
    const productIds = Array.isArray(result.productIds)
      ? result.productIds.map((id) => String(id)).filter((id) => validIds.has(id)).slice(0, 4)
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

async function salesSpacePreviewHandler(req, res) {
  if (!commercialRateLimit(req, res)) return;

  const body = req.body || {};
  const roomData = String(body.data || "");
  const roomMimeType = String(body.mimeType || "image/jpeg");
  const productId = String(body.productId || "");
  const catalog = normalizeCatalog(body.catalog);
  const product = catalog.find((item) => String(item.id) === productId);

  if (!roomData || roomData.length > 12_000_000) {
    return res.status(400).json({ error: "La foto del espacio es demasiado grande o está vacía." });
  }
  if (!product) {
    return res.status(400).json({ error: "Selecciona un producto real del catálogo de Herencia." });
  }

  try {
    const image = await generateGeminiSpacePreview({ roomData, roomMimeType, product });
    res.json({
      image,
      productId: product.id,
      productName: product.name,
      productImage: product.image || "",
      price: Number(product.price || 0),
      currency: "EUR",
      disclaimer: "Visualización orientativa generada por IA. El tamaño, la forma y el color reales pueden variar ligeramente.",
    });
  } catch (error) {
    console.error("[HERENCIA SALES] space preview:", error);
    res.status(502).json({ error: error?.message || "No se pudo generar la visualización en tu espacio." });
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

  if (path === "/api/ai/sales-space-preview") {
    return originalPost.call(this, path, express.json({ limit: "14mb" }), salesSpacePreviewHandler);
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
  if (!paths.has("/api/ai/sales-space-preview")) app.post("/api/ai/sales-space-preview", express.json({ limit: "14mb" }), salesSpacePreviewHandler);

  return originalListen.apply(this, args);
};

console.log("HERENCIA SALES AI PRO preparada: catálogo real, stock/variantes, búsqueda visual, visualizador, ramos y límites de coste.");
