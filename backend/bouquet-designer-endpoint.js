export async function registerBouquetDesignerEndpoint(app) {
  app.post('/api/ai/bouquet-designer', async (req, res) => {
    const { description, budget, style, color, size } = req.body || {};

    const apiKey = process.env.NANO_BANANA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'Falta configurar NANO_BANANA_API_KEY',
      });
    }

    try {
      const prompt = `Bouquet premium hiperrealista. Descripción: ${description}. Estilo: ${style}. Color: ${color}. Tamaño: ${size}. Presupuesto: ${budget} euros. Fotografía profesional de floristería, flores naturales, iluminación premium, imagen comercial.`;

      const response = await fetch('https://api.nanobanana.ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.NANO_BANANA_MODEL || 'nano-banana',
          prompt,
          size: '1024x1024',
        }),
      });

      const data = await response.json();

      res.json({
        proposal: {
          name: description || 'Bouquet premium',
          shortDescription: `${style || 'Elegante'} ${color || 'Mix'}`,
          description: `Ramo ${style || 'premium'} generado por IA para Herencia Market.`,
          recommendedFlowers: ['Rosas', 'Tulipanes', 'Paniculata', 'Eucalipto'],
          sellingTip: 'Diseño generado mediante inteligencia artificial.',
        },
        image: data.image || data.imageUrl || data.url,
        imageGeneratedByAi: true,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message || 'Error generando bouquet IA',
      });
    }
  });
}
