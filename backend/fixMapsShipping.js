import express from "express";

const STORE_ADDRESS =
  process.env.STORE_ADDRESS || "Riera de Cassoles, 08012 Barcelona, Spain";
const BASE_SHIPPING_EUR = Number(process.env.SHIPPING_BASE_PRICE || 5);
const STEP_KM = Number(process.env.SHIPPING_STEP_KM || 3);
const STEP_PRICE_EUR = Number(process.env.SHIPPING_STEP_PRICE || 3);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeAddress({ address = "", city = "", postalCode = "", province = "" }) {
  return [address, postalCode, city, province, "Spain"]
    .map(normalizeText)
    .filter(Boolean)
    .join(", ");
}

function calculateShippingPrice(distanceKm) {
  const km = Number(distanceKm || 0);
  if (!Number.isFinite(km) || km < 0) return BASE_SHIPPING_EUR;

  const extraBlocks = Math.max(0, Math.ceil(km / STEP_KM) - 1);
  return Number((BASE_SHIPPING_EUR + extraBlocks * STEP_PRICE_EUR).toFixed(2));
}

async function calculateDistanceWithGoogleMaps(destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

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

async function shippingHandler(req, res) {
  try {
    const destination = normalizeAddress(req.body || {});

    if (!destination || destination.length < 8) {
      return res.status(400).json({ error: "Introduce una dirección válida para calcular el envío" });
    }

    const result = await calculateDistanceWithGoogleMaps(destination);
    const distanceKm = result.distanceMeters / 1000;
    const price = calculateShippingPrice(distanceKm);

    res.json({
      ok: true,
      price,
      currency: "EUR",
      distanceKm: Number(distanceKm.toFixed(2)),
      distanceText: result.distanceText,
      durationText: result.durationText,
      origin: result.origin,
      destination: result.destination,
      pricing: {
        basePrice: BASE_SHIPPING_EUR,
        stepKm: STEP_KM,
        stepPrice: STEP_PRICE_EUR,
      },
    });
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
