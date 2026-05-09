import express from "express";

const bouquetImages = [
  "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1591886960571-74d43a9d4166?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1562690868-60bbe7293e94?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1559563362-c667ba5f5480?q=80&w=1200&auto=format&fit=crop",
];

function cleanJsonContent(content = "{}") {
  return String(content)
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();
}

function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ""
  );
}

function suggestedName(description, color) {
  const clean = normalizeText(description, `Ramo ${color || "Herencia"}`)
    .replace(/^quiero\s+/i, "")
    .trim();
  const base = clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function pickImage({ description = "", color = "", style = "" }) {
  const seed = `${description}-${color}-${style}`
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return bouquetImages[Math.abs(seed) % bouquetImages.length];
}

function createFallbackProposal(payload = {}) {
  const description = normalizeText(payload.description, "ramo elegante de flores frescas");
  const budget = Number(payload.budget || 49.9);
  const style = normalizeText(payload.style, "Elegante");
  const color = normalizeText(payload.color, "Mix");
  const size = normalizeText(payload.size, "M");

  const recommendedFlowers =
    color.toLowerCase() === "rojo"
      ? ["Rosa roja", "Eucalipto", "Paniculata", "Ruscus verde"]
      : color.toLowerCase() === "blanco"
        ? ["Rosa blanca", "Lirio blanco", "Paniculata", "Eucalipto"]
        : color.toLowerCase() === "amarillo"
          ? ["Girasol", "Rosa crema", "Solidago", "Eucalipto"]
          : ["Rosa", "Tulipán", "Paniculata", "Eucalipto"];

  return {
    name: suggestedName(description, color),
    shortDescription: `Ramo ${style.toLowerCase()} tamaño ${size} desde ${budget.toFixed(2)} €`,
    description: `Ramo ${style.toLowerCase()} en tonos ${color.toLowerCase()}, pensado para Herencia Market. Una composición fresca, bonita y comercial para regalar en ocasiones especiales.`,
    recommendedFlowers,
    imagePrompt: `Fotografía profesional, realista y premium de ecommerce de UN RAMO COMPLETO de flores frescas, estilo ${style.toLowerCase()}, color principal ${color.toLowerCase()}, presupuesto ${budget.toFixed(2)} €, tamaño ${size}. Idea del cliente: ${description}. El ramo debe verse entero, centrado, con envoltorio elegante de floristería, composición abundante y bonita, luz cálida natural, fondo limpio, sin texto, sin logos, sin marcas de agua, sin personas, sin manos, sin jarrón si no se pide.`,
    sellingTip: "Ideal para vender como ramo premium personalizado.",
  };
}

function buildGroqPrompt(payload = {}) {
  const fallback = createFallbackProposal(payload);

  return `Crea una propuesta profesional para Herencia Market, floristería premium.
Descripción: ${normalizeText(payload.description, "ramo elegante")}
Presupuesto: ${Number(payload.budget || 49.9)} euros
Estilo: ${normalizeText(payload.style, "Elegante")}
Color principal: ${normalizeText(payload.color, "Mix")}
Tamaño: ${normalizeText(payload.size, "M")}

Devuelve SOLO JSON válido con esta estructura exacta:
{
  "name": "${fallback.name}",
  "shortDescription": "descripción corta para catálogo",
  "description": "descripción bonita y vendedora",
  "recommendedFlowers": ["flor", "flor"],
  "imagePrompt": "prompt fotorealista premium para generar imagen de UN RAMO COMPLETO, sin texto, sin logos, sin marcas de agua, sin personas",
  "sellingTip": "frase breve para venderlo mejor"
}`;
}

function extractImageUrl(data) {
  return (
    data?.data?.outputImageUrls?.[0] ||
    data?.outputImageUrls?.[0] ||
    data?.data?.imageUrl ||
    data?.imageUrl ||
    data?.url ||
    data?.data?.url ||
    ""
  );
}

async function generateProposalWithGroq(payload = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY no está configurada");
  }

  const timeoutMs = Number(process.env.AI_BOUQUET_TIMEOUT_MS || 10000);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLAMA_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.7,
      stream: false,
      messages: [
        {
          role: "system",
          content: "Eres un director creativo experto en floristería premium. Responde siempre en español y solo con JSON válido.",
        },
        { role: "user", content: buildGroqPrompt(payload) },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Groq respondió ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(cleanJsonContent(content));
}

async function generateImageWithNanoBanana(prompt) {
  if (!process.env.NANO_BANANA_API_KEY) {
    throw new Error("NANO_BANANA_API_KEY no está configurada");
  }

  const timeoutMs = Number(process.env.AI_IMAGE_TIMEOUT_MS || 45000);
  const response = await fetch("https://www.nananobanana.com/api/v1/generate", {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NANO_BANANA_API_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      selectedModel: process.env.NANO_BANANA_MODEL || "nano-banana",
      aspectRatio: "1:1",
      mode: "sync",
    }),
  });

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(`Nano Banana respondió ${response.status}: ${text}`);
  }

  const data = text ? JSON.parse(text) : {};
  const imageUrl = extractImageUrl(data);

  if (!imageUrl) {
    throw new Error("Nano Banana respondió sin URL de imagen");
  }

  return imageUrl;
}

async function generateImageWithGemini(prompt) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY / VITE_GEMINI_API_KEY no está configurada");
  }

  const timeoutMs = Number(process.env.AI_IMAGE_TIMEOUT_MS || 45000);
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${prompt}\n\nDevuelve una imagen fotorealista de producto, cuadrada, lista para catálogo online.`,
              },
            ],
          },
        ],
      }),
    }
  );

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(`Gemini respondió ${response.status}: ${text}`);
  }

  const data = text ? JSON.parse(text) : {};
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;

  if (!inlineData?.data) {
    throw new Error("Gemini no devolvió imagen");
  }

  return `data:${inlineData.mimeType || inlineData.mime_type || "image/png"};base64,${inlineData.data}`;
}

async function generateBestAvailableImage(prompt, warnings) {
  try {
    return {
      image: await generateImageWithGemini(prompt),
      source: "gemini",
    };
  } catch (error) {
    warnings.push(error?.message || String(error));
    console.warn("[AI Bouquet] Gemini no generó imagen:", error?.message || error);
  }

  try {
    return {
      image: await generateImageWithNanoBanana(prompt),
      source: "nano-banana",
    };
  } catch (error) {
    warnings.push(error?.message || String(error));
    console.warn("[AI Bouquet] Nano Banana no generó imagen:", error?.message || error);
  }

  return null;
}

async function safeAIBouquetHandler(req, res) {
  const payload = req.body || {};
  const fallbackProposal = createFallbackProposal(payload);
  let proposal = fallbackProposal;
  let source = "fallback";
  let imageGeneratedByAi = false;
  let image = pickImage(payload);
  const warnings = [];

  try {
    const aiProposal = await generateProposalWithGroq(payload);
    proposal = {
      ...fallbackProposal,
      ...aiProposal,
      recommendedFlowers:
        Array.isArray(aiProposal.recommendedFlowers) && aiProposal.recommendedFlowers.length
          ? aiProposal.recommendedFlowers
          : fallbackProposal.recommendedFlowers,
      imagePrompt: normalizeText(aiProposal.imagePrompt, fallbackProposal.imagePrompt),
    };
    source = "groq";
  } catch (error) {
    warnings.push(error?.message || String(error));
    console.warn("[AI Bouquet] Usando propuesta local:", error?.message || error);
  }

  const imageResult = await generateBestAvailableImage(proposal.imagePrompt || fallbackProposal.imagePrompt, warnings);

  if (imageResult?.image) {
    image = imageResult.image;
    imageGeneratedByAi = true;
    source = source === "fallback" ? imageResult.source : `${source}+${imageResult.source}`;
  } else {
    console.warn("[AI Bouquet] Usando imagen de catálogo porque no hay proveedor IA disponible");
  }

  res.json({
    proposal,
    image,
    imageGeneratedByAi,
    source,
    warnings,
  });
}

const originalPost = express.application.post;

express.application.post = function patchedPost(path, ...handlers) {
  if (path === "/api/ai/bouquet") {
    const middlewares = handlers.length > 1 ? handlers.slice(0, -1) : [];
    return originalPost.call(this, path, ...middlewares, safeAIBouquetHandler);
  }

  return originalPost.call(this, path, ...handlers);
};

console.log("Ruta /api/ai/bouquet preparada para generar imagen real con Gemini o Nano Banana; si falta clave, usa fallback seguro.");
