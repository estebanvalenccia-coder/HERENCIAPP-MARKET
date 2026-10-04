import express from "express";

const STORE_ADDRESS = String(process.env.STORE_ADDRESS || "").trim();
const SHIPPING_TIERS = [
  { maxKm: 3, price: 3.9 },
  { maxKm: 6, price: 4.9 },
  { maxKm: 9, price: 5.9 },
  { maxKm: 12, price: 6.9 },
  { maxKm: 15, price: 7.9 },
  { maxKm: 20, price: 9.9 },
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeAddress({ address = "", city = "", postalCode = "", province = "" }) {
  return [address, postalCode, city, province, "Spain"]
    .map(normalizeText)
    .filter(Boolean)
    .join(", ");
}

export function calculateShippingPrice(distanceKm) {
  const km = Number(distanceKm || 0);
  if (!Number.isFinite(km) || km < 0) return SHIPPING_TIERS[0].price;

  const tier = SHIPPING_TIERS.find(({ maxKm }) => km <= maxKm);
  if (!tier) {
    const error = new Error("La dirección está fuera del radio de reparto de 20 km");
    error.statusCode = 400;
    throw error;
  }
  return tier.price;
}

export async function calculateDistanceWithGoogleMaps(destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!STORE_ADDRESS) {
    const error = new Error("Falta STORE_ADDRESS en el backend para calcular el reparto");
    error.statusCode = 503;
    throw error;
  }

  if (!apiKey) {
    const error = new Error("Falta GOOGLE_MAPS_API_KEY en el backend");
    error.statusCode = 503;
    throw error;
  }

  const params = new URLSearchParams({
    origins: STORE_ADDRESS,
    destinations: destination,
    mode: "driving",
    units: "metric",
    language: "es",
    region: "es",
    key: apiKey,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.status !== "OK") {
    throw new Error(data.error_message || `Google Maps respondió ${data.status || response.status}`);
  }

  const element = data.rows?.[0]?.elements?.[0];

  if (!element || element.status !== "OK") {
    throw new Error(
      element?.status === "ZERO_RESULTS"
        ? "No se pudo calcular la ruta hasta esa dirección"
        : `Google Maps no pudo validar la dirección (${element?.status || "sin resultado"})`
    );
  }

  return {
    distanceMeters: Number(element.distance?.value || 0),
    distanceText: element.distance?.text || "",
    durationText: element.duration?.text || "",
    origin: STORE_ADDRESS,
    destination,
  };
}

export async function calculateShippingQuote(address = {}) {
  const destination = normalizeAddress(address);
  if (!destination || destination.length < 8) {
    const error = new Error("Introduce una dirección válida para calcular el envío");
    error.statusCode = 400;
    throw error;
  }
  const result = await calculateDistanceWithGoogleMaps(destination);
  const distanceKm = result.distanceMeters / 1000;
  return {
    ok: true,
    price: calculateShippingPrice(distanceKm),
    currency: "EUR",
    distanceKm: Number(distanceKm.toFixed(2)),
    distanceText: result.distanceText,
    durationText: result.durationText,
    destination: result.destination,
    pricing: {
      model: "distance_tiers",
      tiers: SHIPPING_TIERS,
      freeShippingFrom: 49,
    },
  };
}

async function shippingHandler(req, res) {
  try {
    const quote = await calculateShippingQuote(req.body || {});
    res.json(quote);
  } catch (error) {
    console.error("Error calculando envío con Google Maps:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "No se pudo calcular el envío con Google Maps",
    });
  }
}

const originalUse = express.application.use;
let routeInstalled = false;

express.application.use = function patchedUse(...args) {
  const result = originalUse.apply(this, args);
  const hasJsonParser = args.some((arg) => arg?.name === "jsonParser");

  if (!routeInstalled && hasJsonParser && typeof this.post === "function") {
    this.post("/api/shipping/calculate", shippingHandler);
    routeInstalled = true;
  }

  return result;
};
