function cleanJsonContent(content = "{}") {
  return content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function buildBouquetPrompt({ description, budget, style, color, size }) {
  return `Crea una propuesta profesional para Herencia Market, una floristería premium.
Descripción del ramo: ${description || "ramo elegante de flores frescas"}
Presupuesto aproximado: ${budget || 49.9} euros
Estilo: ${style || "Elegante"}
Color principal: ${color || "Rosa"}
Tamaño: ${size || "M"}

Devuelve SOLO JSON válido con esta estructura exacta:
{
  "name": "nombre comercial corto del producto",
  "shortDescription": "descripción corta para catálogo",
  "description": "descripción bonita y vendedora",
  "recommendedFlowers": ["flor", "flor"],
  "imagePrompt": "prompt fotorealista premium para generar imagen del ramo, sin texto, sin logos, sin marcas de agua, sin personas, ramo centrado, iluminación cálida, fondo elegante",
  "sellingTip": "frase breve para venderlo mejor"
}`;
}

async function generateBouquetWithGrok(payload) {
  if (!process.env.XAI_API_KEY) {
    throw new Error("Falta XAI_API_KEY en Railway");
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL || "grok-4.3",
      temperature: 0.7,
      stream: false,
      messages: [
        {
          role: "system",
          content: "Eres un director creativo experto en floristería premium, ecommerce y fotografía de producto. Responde siempre en español y solo con JSON válido.",
        },
        {
          role: "user",
          content: buildBouquetPrompt(payload),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Error de Grok: ${detail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(cleanJsonContent(content));
}

async function generateImageWithNanoBanana(prompt) {
  if (!process.env.NANO_BANANA_API_KEY) {
    throw new Error("Falta NANO_BANANA_API_KEY en Railway");
  }

  const response = await fetch("https://www.nananobanana.com/api/v1/generate", {
    method: "POST",
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

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Error de Nano Banana: ${detail}`);
  }

  const data = await response.json();
  const imageUrl = data?.data?.outputImageUrls?.[0] || data?.outputImageUrls?.[0] || data?.imageUrl || data?.url || "";

  return { imageUrl, raw: data };
}

export function setupAIBouquetRoutes(app, requireAdmin) {
  app.post("/api/ai/bouquet", requireAdmin, async (req, res) => {
    try {
      const result = await generateBouquetWithGrok(req.body || {});
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error.message || "No se pudo generar la propuesta del ramo" });
    }
  });

  app.post("/api/ai/bouquet-image", requireAdmin, async (req, res) => {
    try {
      const { prompt } = req.body || {};
      if (!prompt) return res.status(400).json({ error: "Falta prompt para generar la imagen" });
      const result = await generateImageWithNanoBanana(prompt);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message || "No se pudo generar la imagen del ramo" });
    }
  });

  app.post("/api/ai/bouquet-full", requireAdmin, async (req, res) => {
    try {
      const proposal = await generateBouquetWithGrok(req.body || {});
      const image = await generateImageWithNanoBanana(proposal.imagePrompt);
      res.json({ proposal, image });
    } catch (error) {
      res.status(500).json({ error: error.message || "No se pudo crear el ramo con IA" });
    }
  });
}
