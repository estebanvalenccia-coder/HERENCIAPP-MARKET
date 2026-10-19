import { backendApi } from "./backendStorage";
import { isPlantCareProduct } from "./commerceCatalog";

export type PersistedPlantProfile = {
  description: string;
  scientificName: string;
  difficulty: string;
  toxicity: string;
  petSafe: boolean | null;
  humidity: string;
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
  // Supplier tools occasionally arrive mislabeled as "Plantas"; never request
  // botanical instructions for a shovel, rake, pruning tool or fertilizer.
  if (/\b(pala|rastrillo|tijeras|podadora|azada|herramienta|fertilizante|fungicida|maceta|pulverizador|manguera|guantes|sustrato)\b/i.test(String(product?.name||""))) return {};
  if (!options.force && hasGeneratedPlantProfile(product)) return {};

  const plantName = String(product?.name || "").trim();
  if (!plantName) throw new Error("La planta necesita un nombre antes de generar su ficha");

  let response;
  try {
    response=await backendApi.generatePlantDescription({
      plantName,baseDescription:String(product?.description||"").trim(),
    });
  } catch (error) {
    // A transient Groq problem must NEVER prevent publishing, editing or
    // saving an otherwise valid commerce product. Explicit regeneration still
    // reports the upstream error to the administrator.
    if(options.force)throw error;
    return {};
  }
  const {result}=response;

  const care = result?.care && typeof result.care === "object" ? result.care : {};
  const scientificName = String(result?.scientificName || product?.scientificName || "").trim();
  const difficulty = String(result?.difficulty || product?.difficulty || "").trim();
  const toxicity = String(result?.toxicity || product?.toxicity || "").trim();
  const petSafe = typeof result?.petSafe === "boolean" ? result.petSafe : (typeof product?.petSafe === "boolean" ? product.petSafe : null);
  const humidity = String(result?.humidity || "").trim();
  const description = String(result?.description || product?.description || "").trim();
  const water = String(care.water || product?.water || "").trim();
  const light = String(care.light || product?.light || "").trim();
  const temperature = String(care.temperature || product?.temperature || "").trim();
  const fertilizer = String(care.fertilizer || "").trim();
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
    scientificName,
    difficulty,
    toxicity,
    petSafe,
    humidity,
    care: { water, light, temperature, fertilizer },
    benefits,
    tips,
    generatedAt,
    version: 1,
    source: "publish-ai",
  };

  return {
    description,
    scientificName,
    difficulty,
    toxicity,
    ...(petSafe !== null ? { petSafe } : {}),
    water,
    light,
    temperature,
    plantProfile,
    seoDescription: String(product?.seoDescription || "").trim() || description,
    metadata: {
      ...(product?.metadata || {}),
      plantProfile,
      aiPlantProfileGenerated: true,
      aiPlantProfileGeneratedAt: generatedAt,
    },
  };
}
