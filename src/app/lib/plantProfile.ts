import { backendApi } from "./backendStorage";
import { isPlantCareProduct } from "./commerceCatalog";

export type PersistedPlantProfile = {
  description: string;
  care: {
    water: string;
    light: string;
    temperature: string;
    fertilizer: string;
  };
  benefits: string[];
  tips: string;
  generatedAt: string;
  version: number;
  source: string;
};

export function hasGeneratedPlantProfile(product: any) {
  return Boolean(
    product?.aiPlantProfileGenerated ||
    product?.aiPlantProfileGeneratedAt ||
    product?.plantProfile?.generatedAt
  );
}

export async function buildPlantProfilePublishPatch(
  product: any,
  options: { force?: boolean } = {}
) {
  if (!isPlantCareProduct(product)) return {};
  if (!options.force && hasGeneratedPlantProfile(product)) return {};

  const plantName = String(product?.name || "").trim();
  if (!plantName) throw new Error("La planta necesita un nombre antes de generar su ficha");

  const { result } = await backendApi.generatePlantDescription({
    plantName,
    baseDescription: String(product?.description || "").trim(),
  });

  const care = result?.care && typeof result.care === "object" ? result.care : {};
  const description = String(result?.description || product?.description || "").trim();
  const water = String(result?.water || care.water || product?.water || "").trim();
  const light = String(result?.light || care.light || product?.light || "").trim();
  const temperature = String(result?.temperature || care.temperature || product?.temperature || "").trim();
  const fertilizer = String(result?.fertilizer || care.fertilizer || "").trim();
  const benefits = Array.isArray(result?.benefits)
    ? result.benefits.map((item: unknown) => String(item || "").trim()).filter(Boolean).slice(0, 8)
    : [];
  const tips = String(result?.tips || "").trim();

  if (!description || (!water && !light && !temperature && !fertilizer && !tips)) {
    throw new Error("La IA no devolvió una ficha de planta válida");
  }

  const generatedAt = new Date().toISOString();
  const plantProfile: PersistedPlantProfile = {
    description,
    care: { water, light, temperature, fertilizer },
    benefits,
    tips,
    generatedAt,
    version: 1,
    source: "publish-ai",
  };

  const patch: any = {
    description,
    water,
    light,
    temperature,
    seoDescription: String(product?.seoDescription || "").trim() || description,
    metadata: {
      ...(product?.metadata || {}),
      plantProfile: {
        ...plantProfile,
        scientificName: String(result?.scientificName || product?.scientificName || "").trim(),
        environment: String(result?.environment || product?.environment || "").trim(),
        difficulty: String(result?.difficulty || product?.difficulty || "").trim(),
        petSafe: typeof result?.petSafe === "boolean" ? result.petSafe : Boolean(product?.petSafe),
        toxicity: String(result?.toxicity || product?.toxicity || "").trim(),
        humidity: String(result?.humidity || "").trim(),
        growth: String(result?.growth || "").trim(),
        origin: String(result?.origin || "").trim(),
        careNotes: String(result?.careNotes || tips || "").trim(),
      },
      aiPlantProfileGenerated: true,
      aiPlantProfileGeneratedAt: generatedAt,
    },
  };

  if (String(result?.scientificName || "").trim()) patch.scientificName = String(result.scientificName).trim();
  if (["interior", "exterior", "ambos"].includes(String(result?.environment || "").toLowerCase())) patch.environment = String(result.environment).toLowerCase();
  if (["baja", "indirecta", "sol"].includes(String(result?.light || "").toLowerCase())) patch.light = String(result.light).toLowerCase();
  if (["Fácil", "Media", "Avanzada"].includes(String(result?.difficulty || ""))) patch.difficulty = String(result.difficulty);
  if (typeof result?.petSafe === "boolean") patch.petSafe = result.petSafe;
  if (String(result?.toxicity || "").trim()) patch.toxicity = String(result.toxicity).trim();

  return patch;
}
