// Pure validation for administrator-only, read-only CJ international freight previews.
// Never relax live checkout restrictions using this helper.
import { CJ_PREVIEW_COUNTRIES } from "./supplierMarketplace.js";

export function validateCjEuFreightPreview({ destination = "ES", zip = "" } = {}) {
  const country = String(destination || "").trim().toUpperCase();
  const postalCode = String(zip || "").trim().toUpperCase();
  const error = (message) => {
    const failure = new Error(message);
    failure.statusCode = 422;
    throw failure;
  };
  if (!CJ_PREVIEW_COUNTRIES.includes(country))
    error("El país no está habilitado para consultas CJ. Selecciona un destino de la lista.");
  // All allowed countries permit a country-only informational preview.
  // A ZIP is optional for previews, but REQUIRED for verified live checkout.
  if (postalCode && !/^[A-Z0-9][A-Z0-9 -]{0,13}[A-Z0-9]$/.test(postalCode))
    error("El código postal tiene un formato no admitido.");
  if (country === "ES" && postalCode && !/^\d{5}$/.test(postalCode))
    error("El código postal de España debe tener cinco cifras.");
  return {
    destination: country, zip: postalCode,
    origin: "CN", quantity: 1,
    precision: postalCode ? "postal_estimate" : "country_estimate",
    checkoutEnabled: false,
    manualReviewRequired: true,
    disclaimer: postalCode
      ? "Estimación informativa para el código postal indicado. El pedido real exige dirección, stock y tarifa nuevamente verificados."
      : "Estimación general del país, no precio garantizado para una ciudad. Antes de vender verifica disponibilidad, código postal, IVA y tarifas reales.",
  };
}
